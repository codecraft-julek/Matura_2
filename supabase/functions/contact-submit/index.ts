// Supabase Edge Function: POST /functions/v1/contact-submit   body: { name?, email, topic, message, captchaToken?, website? }
//
// Contact form (/kontakt). Order: cheap checks first (size, honeypot, validation), then the CAPTCHA
// and rate limit, then the database. The page e-mails you the message itself after this says OK: Web3Forms
// only takes requests from browsers on its free plan.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RATE_LIMIT_SALT        already set (shared with the waitlist): IPs are stored only as salted hashes
//   TURNSTILE_SECRET_KEY   optional: when set, the CAPTCHA token is verified with Cloudflare
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { contactSchema, type ContactResponse } from "../_shared/contact.ts";

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT = { limit: 3, windowSeconds: 3600 }; // 3 messages per hour per IP

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
