import { z } from "zod";
import { BILLING_PLANS, type BillingPlanId, CURRENCY, MONTHLY_INTRO_COUPON } from "./billing.ts";

// Creators' codes and partnerships, shared by the Edge Functions (billing-checkout, affiliate-admin)
// and the website (payment page, /admin), so both show the same price and the same form errors.

export const normalizeAffiliateCode = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "");
export const validAffiliateCode = (code: string) => /^[A-Z0-9_-]{3,20}$/.test(code);

/**
 * The one discount of this checkout (Stripe allows only one). A creator's code takes its percent off
 * the first payment, on top of the cheaper first month: 24,99 zł − 10% = 22,49 zł. null = none.
 * billing-checkout creates a missing coupon in Stripe; the id says exactly what it takes off.
 */
export function checkoutCoupon(planId: BillingPlanId, discountPercent: number, firstSubscription: boolean) {
  const intro = planId === "monthly" && firstSubscription ? MONTHLY_INTRO_COUPON : null;
  if (!(discountPercent > 0)) return intro;
  const plan = BILLING_PLANS[planId];
  const base = plan.amount - (intro?.amount_off ?? 0);
  const off = plan.amount - Math.round((base * (100 - discountPercent)) / 100);
  return {
    id: `kod-${discountPercent}-${off}`,
    name: intro ? `Pierwszy miesiąc i kod -${discountPercent}%` : `Kod -${discountPercent}%`,
    amount_off: off,
    currency: CURRENCY,
    duration: "once",
  } as const;
}

/** The first payment in grosze, after that coupon. */
export const firstPayment = (planId: BillingPlanId, coupon: { amount_off: number } | null) => BILLING_PLANS[planId].amount - (coupon?.amount_off ?? 0);

/** 2499 → "24,99 zł", 12900 → "129 zł" */
export const formatPln = (grosze: number) => `${(grosze / 100).toLocaleString("pl-PL", { minimumFractionDigits: grosze % 100 ? 2 : 0, maximumFractionDigits: 2 })} zł`;

/** "123,45" / "123.45" / "1 200" → grosze, or null when it isn't an amount. */
export function parsePln(text: string): number | null {
  const clean = text.replace(/\s|zł/gi, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

// ─── /admin forms (validated again by affiliate-admin) ──────────────

const optionalText = (max: number) => z.string().trim().max(max, `Maksymalnie ${max} znaków.`).transform((v) => v || null);
const optionalDate = z.union([z.iso.date("Podaj datę."), z.literal("").transform(() => null), z.null()]);
const percent = (max: number) => z.number({ error: "Podaj liczbę." }).int("Bez ułamków.").min(0, "Od 0.").max(max, `Najwyżej ${max}.`);
const grosze = z.number({ error: "Podaj kwotę." }).int().min(0, "Kwota nie może być ujemna.").max(10_000_000, "Za duża kwota.");

export const PLATFORMS = ["TikTok", "Instagram", "YouTube", "Inne"] as const;

export const affiliateSchema = z.object({
  name: z.string().trim().min(1, "Podaj imię albo nick.").max(80, "Maksymalnie 80 znaków."),
  email: z.string().trim().toLowerCase().max(254, "Ten adres jest za długi.").pipe(z.email("Sprawdź adres e-mail.")),
  code: z.string().transform(normalizeAffiliateCode).refine(validAffiliateCode, "3–20 znaków: litery bez polskich znaków, cyfry, - albo _."),
  commissionPercent: percent(100),
  discountPercent: percent(90),
  commissionMonths: z.number({ error: "Podaj liczbę." }).int("Bez ułamków.").min(1, "Co najmniej 1.").max(120, "Najwyżej 120.").nullable(),
  active: z.boolean(),
  platform: z.union([z.enum(PLATFORMS), z.literal("").transform(() => null), z.null()]),
  profileUrl: optionalText(300).refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Wklej cały link, z https://."),
  contact: optionalText(200),
  payoutDetails: optionalText(300),
  adFee: grosze,
  startsOn: optionalDate,
  endsOn: optionalDate,
  notes: optionalText(2000),
}).refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { path: ["endsOn"], message: "Koniec nie może być przed początkiem." });
export type AffiliateInput = z.input<typeof affiliateSchema>;

export const payoutSchema = z.object({
  affiliateId: z.uuid(),
  amount: grosze.min(1, "Podaj kwotę."),
  paidOn: z.iso.date("Podaj datę."),
  note: optionalText(200),
});
