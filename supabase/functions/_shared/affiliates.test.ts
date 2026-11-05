import { describe, expect, it } from "vitest";
import { PLANS } from "../../../src/config/plans";
import { affiliateSchema, checkoutCoupon, firstPayment, formatPln, normalizeAffiliateCode, parsePln, payoutSchema, validAffiliateCode } from "./affiliates";
import { MONTHLY_INTRO_COUPON } from "./billing";

describe("normalizeAffiliateCode", () => {
  it("accepts what people really type", () => {
    expect(normalizeAffiliateCode("  ania20 ")).toBe("ANIA20");
    expect(normalizeAffiliateCode(undefined)).toBe("");
    expect(validAffiliateCode("ANIA_20")).toBe(true);
  });

  it.each(["AB", "A".repeat(21), "ANIA 20", "ŻABA", ""])("refuses %s", (code) => {
    expect(validAffiliateCode(code)).toBe(false);
  });
});

describe("checkoutCoupon", () => {
  const price = (planId: "monthly" | "matura", percent: number, first: boolean) => formatPln(firstPayment(planId, checkoutCoupon(planId, percent, first)));

  it("keeps today's prices when there is no code", () => {
    expect(checkoutCoupon("monthly", 0, true)).toBe(MONTHLY_INTRO_COUPON);
    expect(checkoutCoupon("monthly", 0, false)).toBeNull();
    expect(checkoutCoupon("matura", 0, true)).toBeNull();
  });

  it("takes the code's percent off the cheaper first month", () => {
    expect(price("monthly", 10, true)).toBe("22,49 zł");
    expect(price("monthly", 20, true)).toBe("19,99 zł");
    expect(checkoutCoupon("monthly", 10, true)).toMatchObject({ id: "kod-10-750", amount_off: 750, duration: "once", name: "Pierwszy miesiąc i kod -10%" });
  });

  it("takes it off the full price for a returning subscriber and the Pakiet", () => {
    expect(price("monthly", 10, false)).toBe("26,99 zł");
    expect(price("matura", 10, true)).toBe("116,10 zł");
    expect(price("matura", 20, false)).toBe("103,20 zł");
    expect(checkoutCoupon("matura", 10, true)?.name).toBe("Kod -10%");
  });
});

describe("formatPln and parsePln", () => {
  it("writes prices the way the pricing page does", () => {
    const shown = (id: string) => PLANS.find((p) => p.id === id)!.price;
    expect(formatPln(firstPayment("monthly", MONTHLY_INTRO_COUPON))).toBe(shown("monthly"));
    expect(formatPln(firstPayment("matura", null))).toBe(shown("matura"));
    expect(formatPln(0)).toBe("0 zł");
  });

  it.each([["123,45", 12345], ["123.4", 12340], ["1 200 zł", 120000], ["0", 0]])("reads %s", (text, grosze) => {
    expect(parsePln(text)).toBe(grosze);
  });

  it.each(["", "abc", "-5", "1,234", "12,3,4"])("refuses %s", (text) => {
    expect(parsePln(text)).toBeNull();
  });
});

describe("affiliateSchema", () => {
  const valid = {
    name: " Ania ", email: " Ania@Gmail.com ", code: " ania ", commissionPercent: 10, discountPercent: 10, commissionMonths: null, active: true,
    platform: "TikTok", profileUrl: "https://tiktok.com/@ania", contact: "", payoutDetails: "", adFee: 30000, startsOn: "2026-11-01", endsOn: "", notes: "  ",
  };

  it("cleans what the form sends", () => {
    expect(affiliateSchema.parse(valid)).toMatchObject({ name: "Ania", email: "ania@gmail.com", code: "ANIA", contact: null, endsOn: null, notes: null });
  });

  it.each([
    ["code", { code: "a b" }],
    ["email", { email: "nope" }],
    ["commissionPercent", { commissionPercent: 120 }],
    ["discountPercent", { discountPercent: 95 }],
    ["profileUrl", { profileUrl: "tiktok.com/@ania" }],
    ["endsOn", { endsOn: "2026-10-01" }],
  ])("points at %s when it's wrong", (field, change) => {
    const r = affiliateSchema.safeParse({ ...valid, ...change });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path[0]).toBe(field);
  });

  it("needs a payout amount above zero", () => {
    const payout = { affiliateId: "10000000-0000-4000-8000-000000000001", amount: 0, paidOn: "2026-11-15", note: "" };
    expect(payoutSchema.safeParse(payout).success).toBe(false);
    expect(payoutSchema.parse({ ...payout, amount: 6240 }).note).toBeNull();
  });
});
