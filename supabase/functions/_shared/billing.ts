// Payments and plan limits, shared by the billing Edge Functions (Deno), the AI Edge Functions
// and the website (Next.js). No Stripe SDK: we call Stripe's REST API with fetch, so there's
// nothing to keep up to date, and verify webhooks ourselves with Web Crypto (works in both).

/** What we sell. Prices are created on the fly in Checkout, so nothing has to be set up in Stripe. */
export const BILLING_PLANS = {
  monthly: {
    name: "Ogarnij Maturę Premium",
    description: "Więcej narzędzi AI: sprawdzanie wypracowań, notatki, fiszki i tutor. Odnawia się co miesiąc.",
    amount: 2499, // grosze: 24,99 zł
    mode: "subscription",
  },
  matura: {
    name: "Ogarnij Maturę: Pakiet do matury",
    description: "Premium do 31 maja 2027, jedna opłata, bez odnawiania.",
    amount: 12900, // 129 zł
    mode: "payment",
  },
} as const;
export type BillingPlanId = keyof typeof BILLING_PLANS;
export const CURRENCY = "pln";

/** "Pakiet do matury" works until the end of this day (Polish time). Update before selling for the next year. */
export const MATURA_PASS_UNTIL = "2027-05-31T23:59:59+02:00";

export function isBillingPlan(value: unknown): value is BillingPlanId {
  return value === "monthly" || value === "matura";
}

/** Stripe subscription statuses that still give Premium until the end of the paid period. */
export const ACTIVE_SUBSCRIPTION = ["active", "trialing", "past_due"];

// ─── Stripe REST helpers ─────────────────────────────────────────────

/**
 * Stripe expects form encoding with brackets for nested values:
 * { line_items: [{ price_data: { currency: "pln" } }] } → line_items[0][price_data][currency]=pln
 */
export function toStripeForm(params: Record<string, unknown>): URLSearchParams {
  const form = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
    else if (typeof value === "object") for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
    else form.append(key, String(value));
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return form;
}

/**
 * Checks the Stripe-Signature header of a webhook (HMAC-SHA256 of "<timestamp>.<raw body>"),
 * so nobody but Stripe can tell us "this student paid". Rejects events older than 5 minutes.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** End of the paid period. Newer Stripe API versions keep it on the subscription item. */
export function subscriptionPeriodEnd(sub: {
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number | null }[] };
}): Date | null {
  const seconds = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  return seconds ? new Date(seconds * 1000) : null;
}

// ─── Plan limits ─────────────────────────────────────────────────────

export type QuotaResult = {
  allowed: boolean;
  reason?: "user" | "global";
  plan: "free" | "premium";
  limit: number;
  period: "day" | "week";
};

/** What the limit counts, in the genitive plural: "Wykorzystano limit <sprawdzeń wypracowań>…" */
const QUOTA_NOUN: Record<string, string> = {
  essay_feedback: "sprawdzeń wypracowań",
  open_grading: "ocen AI",
  tutor: "wiadomości do tutora",
  notes: "notatek AI",
  flashcards: "talii z AI",
};

/** The message a student sees when consume_plan_quota() says no. */
export function quotaMessage(feature: string, q: QuotaResult): string {
  if (q.reason === "global") return "AI ma dziś wyjątkowo dużo pracy i skończył się dzienny limit. Spróbuj jutro.";
  const what = QUOTA_NOUN[feature] ?? "użyć AI";
  const when = q.period === "week" ? "na ten tydzień" : "na dziś";
  const back = q.period === "week" ? "Nowy limit od poniedziałku" : "Wróć jutro";
  const upgrade = q.plan === "free" ? ", a z Premium masz go więcej." : ".";
  return `Wykorzystano limit ${what} ${when} (${q.limit}). ${back}${upgrade}`;
}

// ─── Used by the billing Edge Functions ──────────────────────────────

/** Calls Stripe's REST API with the secret key. Throws with Stripe's message on errors. */
export async function stripe<T = Record<string, unknown>>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const form = toStripeForm(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && [...form].length ? `?${form}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? form : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status} ${path}: ${data?.error?.message ?? "unknown error"}`);
  return data as T;
}

/**
 * Where Stripe sends the student back. Uses the page's own address (so localhost, preview and
 * production all work) when it's localhost, SITE_URL, or, before SITE_URL is set, any https site.
 */
export function returnOrigin(requestOrigin: string | null, siteUrl: string | undefined): string | null {
  const site = siteUrl?.replace(/\/+$/, "");
  if (requestOrigin && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  if (requestOrigin && site && requestOrigin === site) return requestOrigin;
  if (site) return site;
  if (requestOrigin && /^https:\/\/[a-z0-9.-]+$/i.test(requestOrigin)) return requestOrigin;
  return null;
}
