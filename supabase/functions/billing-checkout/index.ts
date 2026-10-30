// Supabase Edge Function: POST /functions/v1/billing-checkout   body: { plan, consents }
//
// Starts a payment: check login → validate the plan and consents → refuse if the student already
// has Premium → find or create their Stripe customer → create a Stripe Checkout page → return its
// URL. The website sends the student there; card/BLIK details are typed on Stripe's page only.
// Premium is switched on later by `billing-webhook`, never here.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  required: sk_test_… (testing) or sk_live_… (real money)
//   SITE_URL           optional: e.g. https://ogarnijmature.pl, where Stripe sends students back
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { BILLING_PLANS, CURRENCY, MATURA_PASS_UNTIL, isBillingPlan, returnOrigin, stripe } from "../_shared/billing.ts";
import { validPurchaseConsents, purchaseConsentMetadata } from "../_shared/purchase-consents.ts";

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
    return await handle(request);
  } catch (err) {
    console.error("billing-checkout crashed:", err);
    return json({ ok: false, error: "Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę." }, 500);
  }
});

async function handle(request: Request) {
  // 1. Who is paying?
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  // 2. Payments switched on?
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) return json({ ok: false, error: "Płatności jeszcze nie działają. Zajrzyj tu wkrótce!" }, 503);

  // 3. Validate: a plan we sell, and all three consents ticked (the website shows them).
  const raw = await request.text();
  if (raw.length > 2_000) return json({ ok: false, error: "Nieprawidłowe dane." }, 413);
  let body: { plan?: unknown; consents?: unknown; termsVersion?: unknown };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400);
  }
  if (!isBillingPlan(body.plan)) return json({ ok: false, error: "Wybierz plan." }, 400);
  if (!validPurchaseConsents(body.consents, body.termsVersion)) {
    return json({ ok: false, error: "Odśwież stronę i potwierdź aktualny regulamin, wiek oraz żądanie rozpoczęcia usługi." }, 400);
  }
  const planId = body.plan;
  const plan = BILLING_PLANS[planId];

  // 4. Already Premium? Don't take money twice.
  const { data: account } = await admin
    .from("billing_accounts")
    .select("stripe_customer_id, subscription_until, pass_until")
    .eq("user_id", user.id)
    .maybeSingle();
  const until = [account?.subscription_until, account?.pass_until].filter(Boolean).map((d) => new Date(d!).getTime());
  if (until.some((t) => t > Date.now())) {
    return json({ ok: false, error: "Masz już Premium. Szczegóły znajdziesz na stronie konta." }, 409);
  }

  // 5. One Stripe customer per student (keeps receipts and the subscription together).
  const newCustomer = async () => {
    const customer = await stripe<{ id: string }>(secretKey, "POST", "customers", {
      email: user.email,
      metadata: { user_id: user.id },
      preferred_locales: ["pl"],
    });
    const { error } = await admin
      .from("billing_accounts")
      .upsert({ user_id: user.id, stripe_customer_id: customer.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    return customer.id;
  };
  let customerId = account?.stripe_customer_id ?? (await newCustomer());

  // 6. The Checkout page. Prices are defined right here (price_data), so nothing to set up in Stripe.
  const origin = returnOrigin(request.headers.get("origin"), Deno.env.get("SITE_URL"));
  if (!origin) return json({ ok: false, error: "Nie udało się otworzyć płatności." }, 400);
  const metadata = {
    user_id: user.id,
    plan: planId,
    ...purchaseConsentMetadata(new Date().toISOString()),
    terms_version: typeof body.termsVersion === "string" ? body.termsVersion.slice(0, 20) : "",
  };
  const createSession = (customer: string) => stripe<{ url: string }>(secretKey, "POST", "checkout/sessions", {
    mode: plan.mode,
    customer,
    client_reference_id: user.id,
    locale: "pl",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: plan.amount,
          product_data: { name: plan.name, description: plan.description },
          ...(plan.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
        },
      },
    ],
    metadata,
    ...(plan.mode === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata: { ...metadata, pass_until: MATURA_PASS_UNTIL } } }),
    // Codes only for the one-time Pakiet: a 100% code on the subscription still asks for a card
    // and starts charging from the second month, which testers don't expect.
    allow_promotion_codes: plan.mode === "payment",
    success_url: `${origin}/premium/gotowe?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/premium/platnosc?plan=${planId}&anulowano=1`,
  });

  let session: { url: string };
  try {
    session = await createSession(customerId);
  } catch (err) {
    // The saved customer is gone (deleted in Stripe, or you switched from test to live keys): make a new one.
    if (!/No such customer/i.test(String(err))) throw err;
    customerId = await newCustomer();
    session = await createSession(customerId);
  }
  return json({ ok: true, url: session.url });
}
