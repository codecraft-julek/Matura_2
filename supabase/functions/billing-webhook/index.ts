// Supabase Edge Function: POST /functions/v1/billing-webhook   (called by Stripe, not the website)
//
// Stripe tells us what happened with a payment. This is the ONLY place that switches Premium on
// or off: every request must carry a valid Stripe signature (STRIPE_WEBHOOK_SECRET), and for
// subscriptions we re-read the current state from Stripe instead of trusting the event body, so
// events arriving late or out of order can't leave a wrong state.
//
// Handled events (pick exactly these when adding the endpoint in Stripe → Developers → Webhooks):
//   checkout.session.completed               paid → Pakiet do matury on / subscription synced
//   checkout.session.async_payment_succeeded a delayed payment (e.g. bank transfer) went through
//   customer.subscription.created|updated|deleted   renewals, cancellations, failed payments
//   invoice.paid                             a monthly renewal was paid
//   charge.refunded                          Pakiet refunded in full → Premium off
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY      sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET  whsec_… (shown by Stripe for this endpoint)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { ACTIVE_SUBSCRIPTION, MATURA_PASS_UNTIL, stripe, subscriptionPeriodEnd, verifyStripeSignature } from "../_shared/billing.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const text = (body: string, status = 200) => new Response(body, { status });

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };
type Subscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  metadata?: Record<string, string>;
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number | null }[] };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return text("Method not allowed", 405);
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) return text("Payments are not configured", 503);

  const raw = await request.text();
  if (!(await verifyStripeSignature(raw, request.headers.get("stripe-signature"), webhookSecret))) {
    return text("Bad signature", 400);
  }
  const event = JSON.parse(raw) as StripeEvent;

  // Already handled? (Stripe retries and may send duplicates.)
  const { data: seen } = await admin.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return text("ok (duplicate)");

  try {
    await handle(event, secretKey);
  } catch (err) {
    // A 500 makes Stripe retry later (for up to 3 days), so a hiccup doesn't lose a payment.
    console.error(`billing-webhook ${event.type} ${event.id} failed:`, err);
    return text("Failed, please retry", 500);
  }
  await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  return text("ok");
});

async function handle(event: StripeEvent, secretKey: string) {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (o.mode === "subscription" && o.subscription) {
        await syncSubscription(secretKey, String(o.subscription), o.metadata?.user_id);
      } else if (o.mode === "payment" && ["paid", "no_payment_required"].includes(o.payment_status) && o.metadata?.plan === "matura") {
        // no_payment_required: a 100% promotion code (e.g. for testers), nothing was charged.
        await grantPass(await userIdFor(o.metadata?.user_id, o.customer), String(o.customer));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(secretKey, String(o.id), o.metadata?.user_id);
    case "invoice.paid": {
      const subId = o.subscription ?? o.parent?.subscription_details?.subscription;
      if (subId) await syncSubscription(secretKey, String(subId));
      return;
    }
    case "charge.refunded": {
      if (!o.refunded || !o.payment_intent) return; // partial refund: Premium stays
      const pi = await stripe<{ metadata?: Record<string, string> }>(secretKey, "GET", `payment_intents/${o.payment_intent}`);
      if (pi.metadata?.plan !== "matura") return; // subscription refunds: cancel the subscription in Stripe
      const userId = await userIdFor(pi.metadata?.user_id, o.customer);
      await upsert(userId, { pass_until: null });
      console.log(`Pakiet refunded, Premium off for ${userId}`);
      return;
    }
    default:
      return; // other events: nothing to do
  }
}

/** Reads the subscription fresh from Stripe and saves what it means for the student. */
async function syncSubscription(secretKey: string, subscriptionId: string, hintUserId?: string) {
  const sub = await stripe<Subscription>(secretKey, "GET", `subscriptions/${subscriptionId}`);
  const userId = await userIdFor(sub.metadata?.user_id ?? hintUserId, sub.customer);
  const active = ACTIVE_SUBSCRIPTION.includes(sub.status);

  // An old, ended subscription mustn't overwrite a newer one the student has now.
  const { data: current } = await admin
    .from("billing_accounts")
    .select("stripe_subscription_id, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!active && current?.stripe_subscription_id && current.stripe_subscription_id !== sub.id
      && ACTIVE_SUBSCRIPTION.includes(current.subscription_status ?? "")) {
    return;
  }

  await upsert(userId, {
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_until: active ? subscriptionPeriodEnd(sub)?.toISOString() ?? null : null,
    cancel_at_period_end: sub.cancel_at_period_end || Boolean(sub.cancel_at),
  });
}

async function grantPass(userId: string, customerId: string) {
  await upsert(userId, { stripe_customer_id: customerId, pass_until: MATURA_PASS_UNTIL });
  console.log(`Pakiet do matury on for ${userId}`);
}

async function upsert(userId: string, values: Record<string, unknown>) {
  const { error } = await admin
    .from("billing_accounts")
    .upsert({ user_id: userId, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** The student: from our metadata, or else from the Stripe customer we saved for them. */
async function userIdFor(metadataUserId: string | undefined, customerId: unknown): Promise<string> {
  if (metadataUserId && /^[0-9a-f-]{36}$/i.test(metadataUserId)) return metadataUserId;
  const { data } = await admin.from("billing_accounts").select("user_id").eq("stripe_customer_id", String(customerId)).maybeSingle();
  if (!data) throw new Error(`no student for Stripe customer ${customerId}`);
  return data.user_id;
}
