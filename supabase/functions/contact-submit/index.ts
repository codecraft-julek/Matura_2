// Supabase Edge Function: POST /functions/v1/contact-submit   body: { name?, email, topic, message, captchaToken?, website? }
//
// Contact form (/kontakt). Order: cheap checks first (size, honeypot, validation), then the CAPTCHA
// and rate limit, then the database. Then e-mails you each message via FormSubmit, in the background.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RATE_LIMIT_SALT        already set (shared with the waitlist): IPs are stored only as salted hashes
//   TURNSTILE_SECRET_KEY   optional: when set, the CAPTCHA token is verified with Cloudflare
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { contactSchema, topicLabel, type ContactResponse } from "../_shared/contact.ts";

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT = { limit: 3, windowSeconds: 3600 }; // 3 messages per hour per IP
const SITE_URL = "https://www.ogarnijmature.com";
const NOTIFY_EMAIL = "ogarnijmature@o2.pl"; // the public contact address (SITE.contactEmail); FormSubmit activates it once by e-mail
const NOTIFY_TIMEOUT_MS = 120_000; // FormSubmit can take over a minute to answer

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: ContactResponse, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const GENERIC_ERROR = "Nie udało się wysłać. Spróbuj ponownie za chwilę.";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("contact-submit crashed:", err);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }
});

async function handle(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "Ta wiadomość jest za długa." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: GENERIC_ERROR }, 400);
  }

  // Honeypot: a hidden field only bots fill in. Pretend it worked, save nothing.
  if (typeof body === "object" && body && (body as { website?: unknown }).website) return json({ ok: true });

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors }, 400);
  }
  const d = parsed.data;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!(await captchaPasses(d.captchaToken, ip))) {
    return json({ ok: false, error: "Nie udało się sprawdzić, czy nie jesteś botem. Odśwież stronę i spróbuj ponownie." }, 400);
  }
  if (!(await isUnderRateLimit(ip))) {
    return json({ ok: false, error: "Za dużo wiadomości naraz. Spróbuj ponownie za godzinę." }, 429);
  }

  // Logged in? Link the message to the account (helps answering "my essay doesn't load").
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  let userId: string | null = null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  const { error } = await admin
    .from("contact_messages")
    .insert({ name: d.name, email: d.email, topic: d.topic, message: d.message, user_id: userId });
  if (error) {
    console.error("contact insert failed:", error.code, error.message);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }

  // In the background, so a slow FormSubmit never holds up the student. The message is saved either way.
  EdgeRuntime.waitUntil(notify(d).catch((err) => console.error("contact notify failed:", err)));
  return json({ ok: true });
}

/** Cloudflare Turnstile check, only when TURNSTILE_SECRET_KEY is set. */
async function captchaPasses(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip !== "unknown") form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`contact:${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function isUnderRateLimit(ip: string): Promise<boolean> {
  const { data, error } = await admin.rpc("hit_rate_limit", {
    p_key: await hashIp(ip),
    p_limit: RATE_LIMIT.limit,
    p_window_seconds: RATE_LIMIT.windowSeconds,
  });
  if (error) {
    console.error("Rate limit check failed:", error.message);
    return true; // fail open: better one extra message than blocking a real student
  }
  return data === true;
}

/** E-mail to you via FormSubmit. Reply goes straight to the student. It refuses requests with no site address. */
async function notify(d: { name?: string; email: string; topic: string; message: string }) {
  const res = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE_URL, Referer: `${SITE_URL}/kontakt` },
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    body: JSON.stringify({
      _subject: `[Kontakt] ${topicLabel(d.topic)}`,
      _template: "box",
      _captcha: "false", // the form has its own honeypot and rate limit
      _replyto: d.email,
      "Imię": d.name || "(bez imienia)",
      email: d.email,
      Temat: topicLabel(d.topic),
      "Wiadomość": d.message,
    }),
  });
  const answer = await res.json().catch(() => null); // refusals also come back as HTTP 200
  if (String(answer?.success) !== "true") throw new Error(`FormSubmit ${res.status}: ${String(answer?.message).slice(0, 200)}`);
}
