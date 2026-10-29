// Supabase Edge Function: POST /functions/v1/waitlist-signup
//
// Runs on Supabase (Deno runtime), not on Vercel. That's why all secrets live in Supabase:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: injected automatically by Supabase
//   - RATE_LIMIT_SALT: set once with `supabase secrets set`
//
// Order matters: cheap checks first (size, honeypot, validation), then the database.

import { createClient } from "@supabase/supabase-js";
import { CONSENT_VERSION, waitlistSchema, type WaitlistResponse } from "../_shared/waitlist.ts";

const MAX_BODY_BYTES = 4_000;
const RATE_LIMIT = { limit: 5, windowSeconds: 600 }; // 5 attempts per 10 min per IP

// The browser calls this function from your website (a different domain), so we must allow it (CORS).
// "*" is fine here: the endpoint is public anyway and protected by validation, honeypot and rate limiting.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: WaitlistResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GENERIC_ERROR = "Nie udało się zapisać. Spróbuj ponownie za chwilę.";

Deno.serve(async (request) => {
  // Browsers send an OPTIONS "preflight" request before the real POST.
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    return await handleSignup(request);
  } catch (err) {
    console.error("Waitlist signup crashed:", err);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }
});

async function handleSignup(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie." }, 400);
  }

  // Honeypot: if the hidden field is filled, it's a bot. Pretend it worked, save nothing.
  if (typeof body === "object" && body && (body as { website?: unknown }).website) {
    return json({ ok: true });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors }, 400);
  }

  if (!(await isUnderRateLimit(getClientIp(request)))) {
    return json({ ok: false, error: "Za dużo prób naraz. Odczekaj kilka minut i spróbuj ponownie." }, 429);
  }

  const d = parsed.data;
  const { error } = await supabase.from("waitlist_signups").insert({
    email: d.email,
    subjects: d.subjects,
    matura_year: d.maturaYear,
    consent_privacy: d.consentPrivacy,
    age_confirmed: d.ageConfirmed,
    consent_version: CONSENT_VERSION,
    utm_source: d.utmSource,
    utm_medium: d.utmMedium,
    utm_campaign: d.utmCampaign,
    ref: d.ref,
  });

  if (error) {
    // 23505 = unique_violation: this email is already on the list.
    // Same success message on purpose, so nobody can check whether someone else signed up.
    if (error.code === "23505") return json({ ok: true });

    console.error("Waitlist insert failed:", error.code, error.message);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }

  return json({ ok: true });
}

function getClientIp(request: Request): string {
  // The first entry of x-forwarded-for is the real client.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// We never store raw IPs (personal data under GDPR), only a salted SHA-256 hash.
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? "";
  const bytes = new TextEncoder().encode(`waitlist:${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The counter lives in Postgres (see hit_rate_limit in the migration), so it works
// no matter how many copies of this function are running.
async function isUnderRateLimit(ip: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_key: await hashIp(ip),
    p_limit: RATE_LIMIT.limit,
    p_window_seconds: RATE_LIMIT.windowSeconds,
  });
  if (error) {
    // Fail open: if the limiter breaks, we'd rather accept a signup than block a real student.
    console.error("Rate limit check failed:", error.message);
    return true;
  }
  return data === true;
}
