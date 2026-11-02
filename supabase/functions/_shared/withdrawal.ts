import { z } from "zod";
import { ACTIVE_SUBSCRIPTION, BILLING_PLANS, type BillingPlanId, MATURA_PASS_UNTIL, isBillingPlan } from "./billing.ts";

// Withdrawing from a purchase within 14 days: the rules, without any network or database.
// Used by the Edge Function `billing-withdrawal`.

export const WITHDRAWAL_ACTION = z.enum(["status", "confirm"]);

export const withdrawalSchema = z.object({
  sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(255),
  name: z.string().trim().min(2, "Podaj imię i nazwisko.").max(120, "Maksymalnie 120 znaków."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Ten adres jest za długi.")
    .pipe(z.email("Sprawdź adres e-mail, wyślemy na niego potwierdzenie.")),
});

/** The fields of a Stripe Checkout session we rely on. */
export type CheckoutSession = {
  id: string;
  created: number;
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
};

export type BillingRow = {
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_until: string | null;
  pass_until: string | null;
};

export type Contract = {
  sessionId: string;
  plan: BillingPlanId;
  planName: string;
  purchasedAt: string;
  deadline: string;
  periodEnd: string;
  amountPaid: number;
  subscriptionId: string | null;
};

const warsaw = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", timeZoneName: "longOffset",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: Number(part("year")), month: Number(part("month")), day: Number(part("day")), offset: part("timeZoneName").replace("GMT", "") || "+00:00" };
};

/**
 * Last moment to withdraw: the end of the 14th day after the purchase, Polish time. The day of the
 * purchase doesn't count, and a deadline falling on a weekend moves to Monday.
 */
export function withdrawalDeadline(purchasedAt: Date): Date {
  const start = warsaw(purchasedAt);
  const last = new Date(Date.UTC(start.year, start.month - 1, start.day + 14, 12));
  const weekday = last.getUTCDay();
  if (weekday === 6) last.setUTCDate(last.getUTCDate() + 2);
  if (weekday === 0) last.setUTCDate(last.getUTCDate() + 1);
  const end = warsaw(last);
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${end.year}-${pad(end.month)}-${pad(end.day)}T23:59:59.999${end.offset}`);
}

/** The newest purchase the student can still withdraw from, or null. */
export function eligibleContract(
  sessions: CheckoutSession[],
  billing: BillingRow,
  withdrawnSessionIds: string[],
  now = new Date(),
): Contract | null {
  const newestFirst = [...sessions].sort((a, b) => b.created - a.created);
  for (const s of newestFirst) {
    const plan = s.metadata?.plan;
    if (!isBillingPlan(plan) || s.status !== "complete") continue;
    if (!["paid", "no_payment_required"].includes(s.payment_status)) continue;
    if (withdrawnSessionIds.includes(s.id)) continue;
    const purchased = new Date(s.created * 1000);
    const deadline = withdrawalDeadline(purchased);
    if (now > deadline) continue;

    // The purchase must still give access: otherwise it has already been settled another way.
    const until = plan === "matura"
      ? billing.pass_until
      : s.subscription === billing.stripe_subscription_id && ACTIVE_SUBSCRIPTION.includes(billing.subscription_status ?? "")
      ? billing.subscription_until
      : null;
    if (!until || new Date(until) <= now) continue;

    return {
      sessionId: s.id,
      plan,
      planName: BILLING_PLANS[plan].name,
      purchasedAt: purchased.toISOString(),
      deadline: deadline.toISOString(),
      periodEnd: plan === "matura" ? new Date(MATURA_PASS_UNTIL).toISOString() : new Date(until).toISOString(),
      amountPaid: s.amount_total ?? 0,
      subscriptionId: plan === "monthly" ? s.subscription ?? null : null,
    };
  }
  return null;
}

/**
 * What to give back (grosze): the price minus the part of the paid period that has passed. A
 * suggestion for the e-mail to you; the refund itself is made by hand in Stripe.
 */
export function suggestedRefund(amountPaid: number, purchasedAt: Date, periodEnd: Date, now = new Date()): number {
  const total = periodEnd.getTime() - purchasedAt.getTime();
  if (total <= 0 || amountPaid <= 0) return 0;
  const used = Math.min(1, Math.max(0, (now.getTime() - purchasedAt.getTime()) / total));
  return amountPaid - Math.round(amountPaid * used);
}

export const formatPln = (grosze: number) => `${(grosze / 100).toFixed(2).replace(".", ",")} zł`;

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "medium" }).format(new Date(iso));

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long" }).format(new Date(iso));

export type WithdrawalRecord = {
  received_at: string;
  name: string;
  email: string;
  plan: string;
  stripe_session_id: string;
  stripe_customer_id: string;
  purchased_at: string;
  amount_paid: number;
  suggested_refund: number;
  access_ended_at: string | null;
};

const planName = (plan: string) => (isBillingPlan(plan) ? BILLING_PLANS[plan].name : plan);

/** Latest day to pay the refund: 14 days after we received the statement. */
export const refundDueBy = (receivedAt: string) => new Date(new Date(receivedAt).getTime() + 14 * 86_400_000).toISOString();

/** The confirmation the law requires: what was declared, and the date and time we received it. */
export function acknowledgementEmail(w: WithdrawalRecord) {
  return {
    subject: "Potwierdzenie odstąpienia od umowy: Ogarnij Maturę",
    text: [
      "Otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy.",
      "",
      `Data i godzina otrzymania: ${formatWhen(w.received_at)} (czas polski)`,
      "",
      "Treść oświadczenia:",
      `Oświadczam, że odstępuję od umowy: ${planName(w.plan)}.`,
      `Data zakupu: ${formatDay(w.purchased_at)}`,
      `Imię i nazwisko: ${w.name}`,
      `E-mail do potwierdzenia: ${w.email}`,
      "",
      "Co dalej:",
      w.amount_paid > 0
        ? `Zapłacona kwota: ${formatPln(w.amount_paid)}. Zwrócimy należną część tą samą metodą płatności najpóźniej do ${formatDay(refundDueBy(w.received_at))}. Potrącamy tylko proporcjonalną wartość usługi za czas do odstąpienia, zgodnie z regulaminem.`
        : "Ten zakup nie był płatny, więc nie ma kwoty do zwrotu.",
      w.access_ended_at
        ? "Premium z tego zakupu jest wyłączone, a subskrypcja nie odnowi się. Twoje konto i materiały zostają."
        : "Premium z tego zakupu wyłączymy wkrótce, a subskrypcja nie odnowi się. Twoje konto i materiały zostają.",
      "",
      "Masz pytanie? Odpisz na tę wiadomość.",
      "Ogarnij Maturę",
    ].join("\n"),
  };
}

/** The customer's page in the Stripe dashboard, in the sandbox or live, whichever the key belongs to. */
export function stripeCustomerUrl(customerId: string, accountId: string | null, secretKey: string): string {
  const account = accountId ? `/${accountId}` : "";
  const mode = secretKey.startsWith("sk_test_") ? "/test" : "";
  return `https://dashboard.stripe.com${account}${mode}/customers/${customerId}`;
}

/** The e-mail to you: everything needed to make the refund in Stripe. */
export function operatorEmail(w: WithdrawalRecord, customerUrl?: string) {
  return {
    subject: `[Odstąpienie] ${planName(w.plan)}, ${w.amount_paid > 0 ? `zwrot do ${formatDay(refundDueBy(w.received_at))}` : "bez zwrotu"}`,
    text: [
      `Otrzymano: ${formatWhen(w.received_at)}`,
      `Osoba: ${w.name}, ${w.email}`,
      `Plan: ${planName(w.plan)}`,
      `Zakup: ${formatWhen(w.purchased_at)}`,
      `Zapłacono: ${formatPln(w.amount_paid)}`,
      `Sugerowany zwrot: ${formatPln(w.suggested_refund)}`,
      `Klient w Stripe: ${w.stripe_customer_id}`,
      `Sesja płatności: ${w.stripe_session_id}`,
      "",
      w.access_ended_at
        ? "Premium z tego zakupu jest już wyłączone."
        : "UWAGA: nie udało się wyłączyć Premium. Wyłącz je ręcznie, a subskrypcję anuluj w Stripe od razu.",
      w.amount_paid > 0
        ? `Zrób zwrot w Stripe: Payments → płatność → Refund → kwota. Termin: ${formatDay(refundDueBy(w.received_at))}.`
        : "Nic nie zapłacono, zwrot nie jest potrzebny.",
      ...(customerUrl ? [`Klient w Stripe: ${customerUrl}`] : []),
    ].join("\n"),
  };
}
