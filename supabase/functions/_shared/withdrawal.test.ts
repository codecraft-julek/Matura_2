import { describe, expect, it } from "vitest";
import {
  type BillingRow,
  type CheckoutSession,
  acknowledgementEmail,
  eligibleContract,
  operatorEmail,
  stripeCustomerUrl,
  suggestedRefund,
  withdrawalDeadline,
  withdrawalSchema,
} from "./withdrawal.ts";

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const pass: CheckoutSession = {
  id: "cs_pass", created: at("2026-11-02T10:00:00Z"), status: "complete", payment_status: "paid", amount_total: 12900, metadata: { plan: "matura" },
};
const monthly: CheckoutSession = {
  id: "cs_sub", created: at("2026-11-02T10:00:00Z"), status: "complete", payment_status: "paid", amount_total: 2499, subscription: "sub_1", metadata: { plan: "monthly" },
};
const noAccess: BillingRow = { stripe_subscription_id: null, subscription_status: null, subscription_until: null, pass_until: null };
const withPass = { ...noAccess, pass_until: "2027-05-31T21:59:59Z" };
const withSub = { ...noAccess, stripe_subscription_id: "sub_1", subscription_status: "active", subscription_until: "2026-12-02T10:00:00Z" };
const now = new Date("2026-11-05T10:00:00Z");

describe("withdrawalDeadline", () => {
  it("ends at the end of the 14th day after the purchase, Polish time", () => {
    // Bought on Monday 2 Nov 2026, 14 days later is Monday 16 Nov; Poland is UTC+1 in November.
    expect(withdrawalDeadline(new Date("2026-11-02T10:00:00Z")).toISOString()).toBe("2026-11-16T22:59:59.999Z");
  });
  it("counts the Polish date, not the UTC one", () => {
    // 23:30 UTC on Monday is already Tuesday 3 Nov in Poland → Tuesday 17 Nov.
    expect(withdrawalDeadline(new Date("2026-11-02T23:30:00Z")).toISOString()).toBe("2026-11-17T22:59:59.999Z");
  });
  it("moves a weekend deadline to Monday", () => {
    expect(withdrawalDeadline(new Date("2026-11-07T10:00:00Z")).toISOString()).toBe("2026-11-23T22:59:59.999Z"); // 21 Nov is a Saturday
    expect(withdrawalDeadline(new Date("2026-11-08T10:00:00Z")).toISOString()).toBe("2026-11-23T22:59:59.999Z"); // 22 Nov is a Sunday
  });
  it("uses the time offset of the last day when the clocks change in between", () => {
    // Bought in summer time (UTC+2), the deadline is already in winter time (UTC+1).
    expect(withdrawalDeadline(new Date("2026-10-20T10:00:00Z")).toISOString()).toBe("2026-11-03T22:59:59.999Z");
  });
});

describe("eligibleContract", () => {
  it("finds a Pakiet that still gives access", () => {
    expect(eligibleContract([pass], withPass, [], now)).toMatchObject({ sessionId: "cs_pass", plan: "matura", amountPaid: 12900, subscriptionId: null });
  });
  it("finds a subscription and remembers which one to cancel", () => {
    expect(eligibleContract([monthly], withSub, [], now)).toMatchObject({ sessionId: "cs_sub", plan: "monthly", subscriptionId: "sub_1" });
  });
  it("treats a 100% promotion code as a purchase with nothing to refund", () => {
    const free = { ...pass, payment_status: "no_payment_required", amount_total: 0 };
    expect(eligibleContract([free], withPass, [], now)).toMatchObject({ amountPaid: 0 });
  });
  it("refuses after the deadline", () => {
    expect(eligibleContract([pass], withPass, [], new Date("2026-11-16T23:00:00Z"))).toBeNull();
  });
  it("accepts on the last moment of the deadline", () => {
    expect(eligibleContract([pass], withPass, [], new Date("2026-11-16T22:59:59Z"))).not.toBeNull();
  });
  it("refuses a purchase already withdrawn from", () => {
    expect(eligibleContract([pass], withPass, ["cs_pass"], now)).toBeNull();
  });
  it("refuses unfinished or unpaid checkouts", () => {
    expect(eligibleContract([{ ...pass, status: "open" }], withPass, [], now)).toBeNull();
    expect(eligibleContract([{ ...pass, payment_status: "unpaid" }], withPass, [], now)).toBeNull();
  });
  it("refuses a purchase that no longer gives access", () => {
    expect(eligibleContract([pass], noAccess, [], now)).toBeNull();
    expect(eligibleContract([monthly], { ...withSub, stripe_subscription_id: "sub_other" }, [], now)).toBeNull();
    expect(eligibleContract([monthly], { ...withSub, subscription_status: "canceled" }, [], now)).toBeNull();
  });
  it("ignores checkouts that aren't ours", () => {
    expect(eligibleContract([{ ...pass, metadata: {} }], withPass, [], now)).toBeNull();
  });
  it("picks the newest purchase", () => {
    const older = { ...monthly, id: "cs_old", created: at("2026-11-01T10:00:00Z") };
    expect(eligibleContract([older, pass], { ...withSub, pass_until: withPass.pass_until }, [], now)?.sessionId).toBe("cs_pass");
  });
});

describe("suggestedRefund", () => {
  const start = new Date("2026-11-01T00:00:00Z");
  const end = new Date("2026-12-01T00:00:00Z");
  it("gives back the part of the period that hasn't passed", () => {
    expect(suggestedRefund(3000, start, end, new Date("2026-11-11T00:00:00Z"))).toBe(2000);
  });
  it("gives back everything right after the purchase", () => {
    expect(suggestedRefund(3000, start, end, start)).toBe(3000);
  });
  it("is never negative or more than was paid", () => {
    expect(suggestedRefund(3000, start, end, new Date("2027-01-01T00:00:00Z"))).toBe(0);
    expect(suggestedRefund(3000, start, end, new Date("2026-01-01T00:00:00Z"))).toBe(3000);
  });
  it("is zero when nothing was paid", () => {
    expect(suggestedRefund(0, start, end, start)).toBe(0);
  });
});

describe("e-mails", () => {
  const record = {
    received_at: "2026-11-05T10:30:15Z", name: "Anna Test", email: "anna@example.com", plan: "matura",
    stripe_session_id: "cs_pass", stripe_customer_id: "cus_1", purchased_at: "2026-11-02T10:00:00Z",
    amount_paid: 12900, suggested_refund: 12700, access_ended_at: "2026-11-05T10:30:16Z",
  };
  it("confirms the statement with the date and time it was received", () => {
    const { text } = acknowledgementEmail(record);
    expect(text).toContain("5 listopada 2026");
    expect(text).toContain("11:30:15");
    expect(text).toContain("Oświadczam, że odstępuję od umowy");
    expect(text).toContain("Anna Test");
    expect(text).toContain("19 listopada 2026"); // refund deadline
  });
  it("doesn't promise a refund when nothing was paid", () => {
    expect(acknowledgementEmail({ ...record, amount_paid: 0, suggested_refund: 0 }).text).toContain("nie ma kwoty do zwrotu");
  });
  it("tells you the refund amount and warns when access couldn't be switched off", () => {
    expect(operatorEmail(record).text).toContain("127,00 zł");
    expect(operatorEmail(record).text).not.toContain("UWAGA");
    expect(operatorEmail({ ...record, access_ended_at: null }).text).toContain("UWAGA");
  });
  it("links to the customer in the right Stripe dashboard", () => {
    expect(stripeCustomerUrl("cus_1", "acct_1", "sk_test_x")).toBe("https://dashboard.stripe.com/acct_1/test/customers/cus_1");
    expect(stripeCustomerUrl("cus_1", "acct_1", "sk_live_x")).toBe("https://dashboard.stripe.com/acct_1/customers/cus_1");
    expect(stripeCustomerUrl("cus_1", null, "sk_live_x")).toBe("https://dashboard.stripe.com/customers/cus_1");
    expect(operatorEmail(record, "https://dashboard.stripe.com/acct_1/customers/cus_1").text).toContain("https://dashboard.stripe.com/acct_1/customers/cus_1");
  });
});

describe("withdrawalSchema", () => {
  it("accepts a filled form and normalises the e-mail", () => {
    expect(withdrawalSchema.parse({ sessionId: "cs_test_a1", name: " Anna ", email: " ANNA@Example.com " })).toEqual({ sessionId: "cs_test_a1", name: "Anna", email: "anna@example.com" });
  });
  it("refuses a missing name, a bad e-mail and a strange session id", () => {
    expect(withdrawalSchema.safeParse({ sessionId: "cs_test_a1", name: "", email: "a@b.pl" }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ sessionId: "cs_test_a1", name: "Anna", email: "nope" }).success).toBe(false);
    expect(withdrawalSchema.safeParse({ sessionId: "../customers", name: "Anna", email: "a@b.pl" }).success).toBe(false);
  });
});
