// Supabase Edge Function: POST /functions/v1/billing-portal
//
// Opens Stripe's customer portal for the logged-in student: cancel the subscription, change the
// card, download receipts. Returns the portal URL; the website sends the student there.
//
// Secrets: STRIPE_SECRET_KEY (and optionally SITE_URL), see billing-checkout.
// One-time setup in Stripe: Settings → Billing → Customer portal → turn on "Cancel subscriptions"
// and save (separately in test mode and in live mode).

import { createClient } from "@supabase/supabase-js";
import { returnOrigin, stripe } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reply = { ok: true; url: string } | { ok: false; error: string };
function json(body: Reply, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user;
    if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) return json({ ok: false, error: "Płatności jeszcze nie działają." }, 503);

    const { data: account } = await admin
      .from("billing_accounts")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!account?.stripe_customer_id) return json({ ok: false, error: "Nie masz jeszcze żadnych płatności." }, 404);

    const origin = returnOrigin(request.headers.get("origin"), Deno.env.get("SITE_URL"));
    if (!origin) return json({ ok: false, error: "Nie udało się otworzyć ustawień płatności." }, 400);
    const portal = await stripe<{ url: string }>(secretKey, "POST", "billing_portal/sessions", {
      customer: account.stripe_customer_id,
      return_url: `${origin}/konto`,
      locale: "pl",
    });
    return json({ ok: true, url: portal.url });
  } catch (err) {
    console.error("billing-portal crashed:", err);
    return json({ ok: false, error: "Nie udało się otworzyć ustawień płatności. Spróbuj ponownie za chwilę." }, 500);
  }
});
