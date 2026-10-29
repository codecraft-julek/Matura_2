import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PLANS } from "../../../src/config/plans";
import {
  BILLING_PLANS,
  quotaMessage,
  returnOrigin,
  subscriptionPeriodEnd,
  toStripeForm,
  verifyStripeSignature,
} from "./billing";

const secret = "whsec_test123";
const sign = (body: string, t: number, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${body}`).digest("hex")}`;

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_800_000_000;

  it("accepts a correct signature", async () => {
    expect(await verifyStripeSignature(body, sign(body, now), secret, now)).toBe(true);
    // Stripe can send several v1 signatures (while you roll the secret): one must match.
    expect(await verifyStripeSignature(body, `${sign(body, now)},v1=deadbeef`, secret, now)).toBe(true);
  });

  it("rejects a changed body, a wrong secret, an old event and junk", async () => {
    expect(await verifyStripeSignature(body + " ", sign(body, now), secret, now)).toBe(false);
    expect(await verifyStripeSignature(body, sign(body, now, "whsec_other"), secret, now)).toBe(false);
    expect(await verifyStripeSignature(body, sign(body, now - 600), secret, now)).toBe(false);
    expect(await verifyStripeSignature(body, "t=abc,v1=", secret, now)).toBe(false);
    expect(await verifyStripeSignature(body, null, secret, now)).toBe(false);
    expect(await verifyStripeSignature(body, sign(body, now), "", now)).toBe(false);
  });
});

describe("toStripeForm", () => {
  it("encodes nested objects and arrays the way Stripe expects", () => {
    const form = toStripeForm({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "pln", unit_amount: 12900 } }],
      metadata: { user_id: "u1", empty: undefined },
    });
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][quantity]")).toBe("1");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("12900");
    expect(form.get("metadata[user_id]")).toBe("u1");
    expect(form.has("metadata[empty]")).toBe(false);
  });
});

describe("subscriptionPeriodEnd", () => {
  it("reads the period end from the subscription or (newer API) its first item", () => {
    expect(subscriptionPeriodEnd({ current_period_end: 1_800_000_000 })?.getTime()).toBe(1_800_000_000_000);
    expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }] } })?.getTime()).toBe(1_800_000_000_000);
    expect(subscriptionPeriodEnd({})).toBeNull();
  });
});

describe("prices", () => {
  it("match what the pricing page shows", () => {
    const shown = (id: string) => PLANS.find((p) => p.id === id)!.price;
    const fmt = (grosze: number) => `${(grosze / 100).toLocaleString("pl-PL", { minimumFractionDigits: grosze % 100 ? 2 : 0 })} zł`;
    expect(fmt(BILLING_PLANS.monthly.amount)).toBe(shown("monthly"));
    expect(fmt(BILLING_PLANS.matura.amount)).toBe(shown("matura"));
  });
});

describe("quotaMessage", () => {
  it("says when the limit comes back and suggests Premium only to free users", () => {
    expect(quotaMessage("notes", { allowed: false, reason: "user", plan: "free", limit: 3, period: "week" })).toBe(
      "Wykorzystano limit notatek AI na ten tydzień (3). Nowy limit od poniedziałku, a z Premium masz go więcej.",
    );
    expect(quotaMessage("tutor", { allowed: false, reason: "user", plan: "premium", limit: 50, period: "day" })).toBe(
      "Wykorzystano limit wiadomości do tutora na dziś (50). Wróć jutro.",
    );
    expect(quotaMessage("tutor", { allowed: false, reason: "global", plan: "free", limit: 10, period: "day" })).toMatch(/Spróbuj jutro/);
  });
});

describe("returnOrigin", () => {
  it("prefers SITE_URL, allows localhost, and only https before SITE_URL is set", () => {
    expect(returnOrigin("http://localhost:3000", "https://ogarnijmature.pl")).toBe("http://localhost:3000");
    expect(returnOrigin("http://127.0.0.1:5173", "https://ogarnijmature.pl")).toBe("http://127.0.0.1:5173");
    expect(returnOrigin("http://[::1]:5173", "https://ogarnijmature.pl")).toBe("http://[::1]:5173");
    expect(returnOrigin("http://127.0.0.1.evil.example", "https://ogarnijmature.pl")).toBe("https://ogarnijmature.pl");
    expect(returnOrigin("https://ogarnijmature.pl", "https://ogarnijmature.pl/")).toBe("https://ogarnijmature.pl");
    expect(returnOrigin("https://evil.example", "https://ogarnijmature.pl")).toBe("https://ogarnijmature.pl");
    expect(returnOrigin("https://matura.vercel.app", undefined)).toBe("https://matura.vercel.app");
    expect(returnOrigin("http://evil.example", undefined)).toBeNull();
    expect(returnOrigin(null, undefined)).toBeNull();
  });
});
