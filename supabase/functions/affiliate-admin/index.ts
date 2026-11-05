// Supabase Edge Function: POST /functions/v1/affiliate-admin   (the /admin panel, admins only)
//   { action: "save", id?, affiliate }          → adds or edits a creator   → { ok, id, inviteSent }
//   { action: "invite", id }                    → e-mails a link to set the panel password
//   { action: "payout", payout }                → records a payout you made by hand
//   { action: "deletePayout", id }              → removes a payout recorded by mistake
//
// A new creator gets a login for their e-mail (no password) and an e-mail with a one-hour link that
// logs them in and asks for a password. Someone who already has an account keeps their password.
// Reading the numbers doesn't come here: /admin calls admin_affiliates() / admin_affiliate().
//
// Secrets: RESEND_API_KEY, CONTACT_FROM_EMAIL (optional), SITE_URL (optional, where links point).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { affiliateSchema, payoutSchema } from "../_shared/affiliates.ts";
import { returnOrigin } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const GENERIC_ERROR = "Nie udało się zapisać. Spróbuj ponownie za chwilę.";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("affiliate-admin crashed:", err);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }
});

async function handle(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);
  const { data: isAdmin, error: adminError } = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError) throw adminError;
  if (!isAdmin) return json({ ok: false, error: "Brak dostępu." }, 403);

  const body = await request.json().catch(() => null);
  const origin = returnOrigin(request.headers.get("origin"), Deno.env.get("SITE_URL"));
  switch (body?.action) {
    case "save":
      return save(body.id, body.affiliate, origin);
    case "invite": {
      const id = z.uuid().safeParse(body.id);
      if (!id.success) return json({ ok: false, error: GENERIC_ERROR }, 400);
      const { data: a, error } = await admin.from("affiliates").select("name, email, code").eq("id", id.data).maybeSingle();
      if (error) throw error;
      if (!a) return json({ ok: false, error: "Nie ma takiego twórcy." }, 404);
      return (await sendInvite(a, origin))
        ? json({ ok: true })
        : json({ ok: false, error: "Nie udało się wysłać maila. Spróbuj ponownie za chwilę." }, 502);
    }
    case "payout": {
      const parsed = payoutSchema.safeParse(body.payout);
      if (!parsed.success) return invalid(parsed.error);
      const p = parsed.data;
      const { error } = await admin.from("affiliate_payouts").insert({
        affiliate_id: p.affiliateId, amount: p.amount, note: p.note,
        paid_at: `${p.paidOn}T12:00:00Z`, // noon UTC is the same day in Poland
      });
      if (error?.code === "23503") return json({ ok: false, error: "Nie ma takiego twórcy." }, 404);
      if (error) throw error;
      return json({ ok: true });
    }
    case "deletePayout": {
      const id = z.uuid().safeParse(body.id);
      if (!id.success) return json({ ok: false, error: GENERIC_ERROR }, 400);
      const { error } = await admin.from("affiliate_payouts").delete().eq("id", id.data);
      if (error) throw error;
      return json({ ok: true });
    }
    default:
      return json({ ok: false, error: GENERIC_ERROR }, 400);
  }
}

function invalid(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors }, 400);
}

async function save(rawId: unknown, input: unknown, origin: string | null) {
  const parsed = affiliateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  let existing: { id: string; user_id: string | null; email: string } | null = null;
  if (rawId !== undefined && rawId !== null) {
    const id = z.uuid().safeParse(rawId);
    if (!id.success) return json({ ok: false, error: GENERIC_ERROR }, 400);
    const { data, error } = await admin.from("affiliates").select("id, user_id, email").eq("id", id.data).maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: "Nie ma takiego twórcy." }, 404);
    existing = data;
  }

  // Checked before making a login, so a taken code doesn't leave an unused account behind.
  let taken = admin.from("affiliates").select("id").eq("code", d.code);
  if (existing) taken = taken.neq("id", existing.id);
  const { data: clash, error: clashError } = await taken.maybeSingle();
  if (clashError) throw clashError;
  if (clash) return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors: { code: "Ten kod ma już inny twórca." } }, 409);

  // The login: kept while the e-mail stays the same, otherwise the account with that e-mail (or a new one).
  let userId = existing?.user_id ?? null;
  let needsPassword = false;
  const loginChanged = !existing || !existing.user_id || existing.email !== d.email;
  if (loginChanged) {
    const { data: found, error } = await admin.rpc("auth_user_by_email", { p_email: d.email });
    if (error) throw error;
    if (found?.[0]) {
      userId = found[0].id;
      needsPassword = !found[0].has_password;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email: d.email, email_confirm: true });
      if (createError) throw createError;
      userId = created.user.id;
      needsPassword = true;
    }
  }

  const row = {
    user_id: userId, email: d.email, name: d.name, code: d.code, active: d.active,
    commission_percent: d.commissionPercent, discount_percent: d.discountPercent, commission_months: d.commissionMonths,
    platform: d.platform, profile_url: d.profileUrl, contact: d.contact, payout_details: d.payoutDetails,
    ad_fee: d.adFee, starts_on: d.startsOn, ends_on: d.endsOn, notes: d.notes,
  };
  const { data: saved, error } = existing
    ? await admin.from("affiliates").update(row).eq("id", existing.id).select("id").single()
    : await admin.from("affiliates").insert(row).select("id").single();
  if (error?.code === "23505") {
    const field = /user_id/.test(error.message) ? "email" : "code";
    const message = field === "email" ? "Ten e-mail ma już inny twórca." : "Ten kod ma już inny twórca.";
    return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors: { [field]: message } }, 409);
  }
  if (error) throw error;

  // The creator saves even when the e-mail fails: /admin can send the link again.
  const inviteSent = loginChanged && needsPassword ? await sendInvite(d, origin) : false;
  return json({ ok: true, id: saved.id, inviteSent });
}

/** A one-hour link that logs the creator in on our site and asks for a new password. */
async function sendInvite(a: { name: string; email: string; code: string }, origin: string | null): Promise<boolean> {
  if (!origin) return false;
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: a.email });
  if (error || !data?.properties?.hashed_token) {
    console.error("affiliate-admin: no password link:", error);
    return false;
  }
  const link = `${origin}/auth/potwierdz?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=${encodeURIComponent("/nowe-haslo")}`;
  return sendEmail(a.email, {
    subject: "Twój panel twórcy w Ogarnij Maturę",
    text: [
      `Cześć ${a.name}!`,
      "",
      `Masz już swój panel w Ogarnij Maturę. Zobaczysz w nim, ile osób użyło Twojego kodu ${a.code} i ile prowizji Ci się należy.`,
      "",
      "Ustaw hasło tutaj (link działa przez godzinę i tylko raz):",
      link,
      "",
      `Później logujesz się na ${origin}/creators`,
      "Link wygasł? Na tej stronie kliknij „Ustaw albo zmień hasło”, a wyślemy nowy.",
      "",
      "Ogarnij Maturę",
    ].join("\n"),
  });
}

async function sendEmail(to: string, mail: { subject: string; text: string }): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is missing, creator e-mail not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("CONTACT_FROM_EMAIL") ?? "Ogarnij Maturę <kontakt@ogarnijmature.com>",
        to: [to],
        reply_to: Deno.env.get("CONTACT_NOTIFY_EMAIL"),
        subject: mail.subject,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("Resend refused the creator e-mail:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Creator e-mail failed:", err);
    return false;
  }
}
