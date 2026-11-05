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
//   charge.refunded                          any Pakiet refund → Premium off; marks a withdrawal as refunded
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
    if (err instanceof StudentGone) {
      // The account was deleted: retrying can't help. Logged so a still-running subscription is
      // noticed (it should have been cancelled before deleting, see delete_my_account).
      console.warn(`billing-webhook ${event.type} ${event.id}: ${err.message}`);
    } else {
      // A 500 makes Stripe retry later (for up to 3 days), so a hiccup doesn't lose a payment.
      console.error(`billing-webhook ${event.type} ${event.id} failed:`, err);
      return text("Failed, please retry", 500);
    }
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
        await noteCheckout(o);
      } else if (o.mode === "payment" && ["paid", "no_payment_required"].includes(o.payment_status) && o.metadata?.plan === "matura") {
        // no_payment_required: a 100% promotion code (e.g. for testers), nothing was charged.
        await grantPass(await userIdFor(o.metadata?.user_id, o.customer), String(o.customer));
        await noteCheckout(o);
        await recordAffiliateSale(o.metadata?.affiliate_id, {
          stripe_ref: String(o.id),
          stripe_customer_id: String(o.customer),
          stripe_subscription_id: null,
          stripe_payment_intent: o.payment_intent ? String(o.payment_intent) : null,
          plan: "matura",
          amount_paid: o.amount_total ?? 0,
          paid_at: new Date(o.created * 1000).toISOString(),
        });
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
      const affiliateId = (o.parent?.subscription_details?.metadata ?? o.subscription_details?.metadata)?.affiliate_id;
      if (subId && affiliateId && o.amount_paid > 0) {
        await recordAffiliateSale(affiliateId, {
          stripe_ref: String(o.id),
          stripe_customer_id: String(o.customer),
          stripe_subscription_id: String(subId),
          stripe_payment_intent: await invoicePaymentIntent(secretKey, o),
          plan: "monthly",
          amount_paid: o.amount_paid,
          paid_at: new Date((o.status_transitions?.paid_at ?? o.created) * 1000).toISOString(),
        });
      }
      return;
    }
    case "charge.refunded": {
      if (!o.payment_intent) return;
      const { error } = await admin
        .from("withdrawals")
        .update({ refunded_at: new Date().toISOString() })
        .eq("stripe_customer_id", String(o.customer))
        .is("refunded_at", null);
      if (error) throw error;
      // amount_refunded is the total so far, so the commission follows every partial refund.
      const { error: saleError } = await admin
        .from("affiliate_sales")
        .update({ refunded_amount: o.amount_refunded ?? 0 })
        .eq("stripe_payment_intent", String(o.payment_intent));
      if (saleError) throw saleError;
      // Partial refunds count too: after withdrawing, the student gets back all but the used part.
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

/** Remembers when the student bought something, so the website can show the withdrawal link. */
async function noteCheckout(session: Record<string, any>) {
  const userId = await userIdFor(session.metadata?.user_id, session.customer);
  await upsert(userId, { last_checkout_at: new Date(session.created * 1000).toISOString() });
}

type AffiliateSale = {
  stripe_ref: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_payment_intent: string | null;
  plan: "monthly" | "matura";
  amount_paid: number;
  paid_at: string;
};

/** One payment made with a creator's code. A retried event adds nothing (stripe_ref is unique). */
async function recordAffiliateSale(affiliateId: string | undefined, sale: AffiliateSale) {
  if (!affiliateId || sale.amount_paid <= 0) return; // a 100% code: nothing paid, nothing earned
  const { data: affiliate, error } = await admin
    .from("affiliates")
    .select("commission_percent, commission_months")
    .eq("id", affiliateId)
    .maybeSingle();
  if (error) throw error;
  if (!affiliate) return;

  // Only the first commission_months paid months of a subscription earn a commission.
  if (sale.stripe_subscription_id && affiliate.commission_months) {
    const { count, error: countError } = await admin
      .from("affiliate_sales")
      .select("id", { count: "exact", head: true })
      .eq("stripe_subscription_id", sale.stripe_subscription_id);
    if (countError) throw countError;
    if ((count ?? 0) >= affiliate.commission_months) return;
  }

  const { error: insertError } = await admin
    .from("affiliate_sales")
    .upsert({ ...sale, affiliate_id: affiliateId, commission_percent: affiliate.commission_percent }, { onConflict: "stripe_ref", ignoreDuplicates: true });
  if (insertError) throw insertError;
}

/** Newer Stripe API versions keep an invoice's payment in its `payments` list. Needed to match a later refund. */
async function invoicePaymentIntent(secretKey: string, invoice: Record<string, any>): Promise<string | null> {
  if (invoice.payment_intent) return String(invoice.payment_intent);
  const full = await stripe<{ payments?: { data?: { payment?: { payment_intent?: string } }[] } }>(secretKey, "GET", `invoices/${invoice.id}`, { expand: ["payments"] });
  return full.payments?.data?.[0]?.payment?.payment_intent ?? null;
}

/** The student behind a Stripe event no longer exists (account deleted). */
class StudentGone extends Error {}

async function upsert(userId: string, values: Record<string, unknown>) {
  const { error } = await admin
    .from("billing_accounts")
    .upsert({ user_id: userId, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error?.code === "23503") throw new StudentGone(`no account ${userId} (deleted)`); // foreign key: user is gone
  if (error) throw error;
}

/** The student: from our metadata, or else from the Stripe customer we saved for them. */
async function userIdFor(metadataUserId: string | undefined, customerId: unknown): Promise<string> {
  if (metadataUserId && /^[0-9a-f-]{36}$/i.test(metadataUserId)) return metadataUserId;
  const { data } = await admin.from("billing_accounts").select("user_id").eq("stripe_customer_id", String(customerId)).maybeSingle();
  if (!data) throw new StudentGone(`no student for Stripe customer ${customerId}`);
  return data.user_id;
}
