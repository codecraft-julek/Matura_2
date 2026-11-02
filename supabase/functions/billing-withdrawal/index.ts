// Supabase Edge Function: POST /functions/v1/billing-withdrawal
//   { action: "status" }                                → what the student can withdraw from
//   { action: "confirm", sessionId, name, email }       → saves the statement and acts on it
//
// "Odstąp od umowy tutaj" on /odstapienie. The statement is saved first, because that alone is what
// counts legally. Then: Premium from that purchase ends, the student gets the confirmation e-mail,
// and you get an e-mail with the amount to refund. The refund itself you make by hand in Stripe.
// Each step is remembered, so sending the same statement again only finishes what failed.
//
// Secrets: STRIPE_SECRET_KEY, RESEND_API_KEY, CONTACT_NOTIFY_EMAIL, CONTACT_FROM_EMAIL (optional).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { stripe } from "../_shared/billing.ts";
import {
  type BillingRow,
  type CheckoutSession,
  type WithdrawalRecord,
  WITHDRAWAL_ACTION,
  acknowledgementEmail,
  eligibleContract,
  operatorEmail,
  stripeCustomerUrl,
  suggestedRefund,
  withdrawalSchema,
} from "../_shared/withdrawal.ts";

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

const GENERIC_ERROR = "Nie udało się zapisać oświadczenia. Spróbuj ponownie albo napisz do nas przez formularz kontaktowy.";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("billing-withdrawal crashed:", err);
    return json({ ok: false, error: GENERIC_ERROR }, 500);
  }
});

async function handle(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) return json({ ok: false, error: "Płatności jeszcze nie działają." }, 503);

  const body = await request.json().catch(() => null);
  const action = WITHDRAWAL_ACTION.safeParse(body?.action);
  if (!action.success) return json({ ok: false, error: GENERIC_ERROR }, 400);

  const { data: done, error: doneError } = await admin
    .from("withdrawals")
    .select("*")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false });
  if (doneError) throw doneError;

  const { data: billing } = await admin
    .from("billing_accounts")
    .select("stripe_customer_id, stripe_subscription_id, subscription_status, subscription_until, pass_until")
    .eq("user_id", user.id)
    .maybeSingle();

  const contract = billing?.stripe_customer_id
    ? eligibleContract(await listSessions(secretKey, billing.stripe_customer_id), billing as BillingRow, (done ?? []).map((w) => w.stripe_session_id))
    : null;

  if (action.data === "status") {
    return json({ ok: true, contract: contract && publicContract(contract), done: (done ?? []).map(publicRecord) });
  }

  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return json({ ok: false, error: "Popraw zaznaczone pola.", fieldErrors }, 400);
  }
  const d = parsed.data;

  // Sent twice (double click, a retry after a lost connection): finish what's left, don't start over.
  let record = (done ?? []).find((w) => w.stripe_session_id === d.sessionId);
  if (!record) {
    if (contract?.sessionId !== d.sessionId) {
      return json({ ok: false, error: "Tego zakupu nie można już wycofać tutaj. Napisz do nas przez formularz kontaktowy." }, 409);
    }
    const now = new Date();
    const { data: inserted, error } = await admin
      .from("withdrawals")
      .insert({
        received_at: now.toISOString(),
        user_id: user.id,
        name: d.name,
        email: d.email,
        plan: contract.plan,
        stripe_customer_id: billing!.stripe_customer_id,
        stripe_session_id: contract.sessionId,
        stripe_subscription_id: contract.subscriptionId,
        purchased_at: contract.purchasedAt,
        period_end: contract.periodEnd,
        amount_paid: contract.amountPaid,
        suggested_refund: suggestedRefund(contract.amountPaid, new Date(contract.purchasedAt), new Date(contract.periodEnd), now),
      })
      .select("*")
      .single();
    if (error) throw error;
    record = inserted;
  }

  const finished = await finish(record!, user.id, secretKey);
  return json({ ok: true, withdrawal: publicRecord(finished) });
}

type Row = WithdrawalRecord & { id: string; stripe_subscription_id: string | null; ack_sent_at: string | null; notified_at: string | null };

/** The steps after saving the statement. A failed step never hides that the statement was received. */
async function finish(start: Row, userId: string, secretKey: string): Promise<Row> {
  let row = start;
  const save = async (values: Partial<Row>) => {
    const { error } = await admin.from("withdrawals").update(values).eq("id", row.id);
    if (error) console.error("withdrawal update failed:", error.message);
    row = { ...row, ...values };
  };

  if (!row.access_ended_at) {
    try {
      await endAccess(row.plan, userId, secretKey, row.stripe_subscription_id);
      await save({ access_ended_at: new Date().toISOString() });
    } catch (err) {
      console.error(`withdrawal ${row.id}: could not end access:`, err);
    }
  }
  if (!row.ack_sent_at && (await sendEmail(row.email, acknowledgementEmail(row)))) {
    await save({ ack_sent_at: new Date().toISOString() });
  }
  const notifyTo = Deno.env.get("CONTACT_NOTIFY_EMAIL");
  if (!row.notified_at && notifyTo) {
    // A failed lookup only shortens the link: the e-mail matters more than the link in it.
    const account = await stripe<{ id: string }>(secretKey, "GET", "account").catch(() => null);
    const customerUrl = stripeCustomerUrl(row.stripe_customer_id, account?.id ?? null, secretKey);
    if (await sendEmail(notifyTo, operatorEmail(row, customerUrl), row.email)) {
      await save({ notified_at: new Date().toISOString() });
    }
  }
  return row;
}

/** Stops the subscription right away (no more charges), or switches the Pakiet off. */
async function endAccess(plan: string, userId: string, secretKey: string, subscriptionId: string | null) {
  const updated_at = new Date().toISOString();
  if (plan === "matura") {
    const { error } = await admin.from("billing_accounts").update({ pass_until: null, updated_at }).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  if (!subscriptionId) throw new Error("monthly withdrawal without a subscription id");
  await stripe(secretKey, "DELETE", `subscriptions/${subscriptionId}`).catch((err) => {
    if (!/No such subscription/i.test(String(err))) throw err; // already gone: that's what we want
  });
  const { error } = await admin
    .from("billing_accounts")
    .update({ subscription_status: "canceled", subscription_until: null, cancel_at_period_end: false, updated_at })
    .eq("user_id", userId)
    .eq("stripe_subscription_id", subscriptionId); // a newer subscription must stay untouched
  if (error) throw error;
}

async function sendEmail(to: string, mail: { subject: string; text: string }, replyTo?: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is missing, withdrawal e-mail not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("CONTACT_FROM_EMAIL") ?? "Ogarnij Maturę <kontakt@ogarnijmature.com>",
        to: [to],
        reply_to: replyTo ?? Deno.env.get("CONTACT_NOTIFY_EMAIL"),
        subject: mail.subject,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("withdrawal e-mail failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("withdrawal e-mail failed:", err);
    return false;
  }
}

async function listSessions(secretKey: string, customer: string): Promise<CheckoutSession[]> {
  const { data } = await stripe<{ data: CheckoutSession[] }>(secretKey, "GET", "checkout/sessions", { customer, status: "complete", limit: 20 });
  return data;
}

const publicContract = ({ subscriptionId: _subscriptionId, periodEnd: _periodEnd, ...c }: NonNullable<ReturnType<typeof eligibleContract>>) => c;

const publicRecord = (w: Row) => ({
  receivedAt: w.received_at,
  plan: w.plan,
  email: w.email,
  amountPaid: w.amount_paid,
  accessEnded: Boolean(w.access_ended_at),
  ackSent: Boolean(w.ack_sent_at),
});
