// Exercise the real billing and affiliate Edge handlers with mocked database/Stripe/e-mail boundaries.
// No real payments, logins or e-mails.
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PURCHASE_CONSENT_VERSION } from "../supabase/functions/_shared/purchase-consents";

const { admin } = vi.hoisted(() => ({
  admin: { auth: { getUser: vi.fn(), admin: { createUser: vi.fn(), generateLink: vi.fn() } }, from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => admin }));

const WEBHOOK_SECRET = "whsec_test";
const AFFILIATE = "10000000-0000-4000-8000-000000000001";
const STUDENT = "20000000-0000-4000-8000-000000000002";
let handler: (request: Request) => Promise<Response>;
let db: Record<string, Record<string, any>[]>;
let stripeCalls: { method: string; path: string; form: URLSearchParams }[];
let missingCoupons: Set<string>;
let emails: { to: string[]; subject: string; text: string }[];

/** Just enough of supabase-js over plain arrays. */
function table(name: string) {
  const filters: ((r: Record<string, any>) => boolean)[] = [];
  let action: (rows: Record<string, any>[]) => void = () => {};
  let written: Record<string, any>[] | null = null;
  let countOnly = false;
  const rows = () => (db[name] ??= []).filter((r) => filters.every((f) => f(r)));
  const run = () => {
    const found = rows();
    action(found);
    return written ?? found;
  };
  const q: any = {
    select: (_?: string, options?: { count?: string }) => { countOnly = Boolean(options?.count); return q; },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
    neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return q; },
    is: (k: string, v: unknown) => { filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return q; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0], error: null }),
    insert: (row: Record<string, any>) => {
      const r = { id: crypto.randomUUID(), ...row };
      (db[name] ??= []).push(r);
      written = [r];
      return q;
    },
    update: (values: Record<string, any>) => { action = (found) => { found.forEach((r) => Object.assign(r, values)); written = found; }; return q; },
    delete: () => { action = (found) => { db[name] = db[name].filter((r) => !found.includes(r)); }; return q; },
    upsert: (row: Record<string, any>, options: { onConflict: string; ignoreDuplicates?: boolean }) => {
      (db[name] ??= []);
      const existing = db[name].find((r) => r[options.onConflict] === row[options.onConflict]);
      if (!existing) db[name].push(row);
      else if (!options.ignoreDuplicates) Object.assign(existing, row);
      written = [];
      return q;
    },
    then: (ok: (value: unknown) => unknown) => {
      const found = run();
      return Promise.resolve({ data: found, count: countOnly ? found.length : null, error: null }).then(ok);
    },
  };
  return q;
}

const stripeReply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fakeStripe = vi.fn(async (input: string, init: RequestInit) => {
  const url = new URL(input);
  if (url.host === "api.resend.com") { emails.push(JSON.parse(String(init.body))); return stripeReply({ id: "email_1" }); }
  const path = url.pathname.replace("/v1/", "");
  const form = init.method === "POST" ? (init.body as URLSearchParams) : url.searchParams;
  stripeCalls.push({ method: init.method!, path, form });
  if (path === "checkout/sessions") {
    const coupon = form.get("discounts[0][coupon]");
    if (coupon && missingCoupons.has(coupon)) return stripeReply({ error: { message: `No such coupon: '${coupon}'` } }, 400);
    return stripeReply({ id: "cs_new", url: "https://stripe.test/pay", client_secret: "secret" });
  }
  if (path === "coupons") { missingCoupons.delete(form.get("id")!); return stripeReply({ id: form.get("id") }); }
  if (path === "customers") return stripeReply({ id: "cus_new" });
  if (path.startsWith("subscriptions/")) {
    return stripeReply({ id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false, cancel_at: null, metadata: { user_id: STUDENT }, current_period_end: 1_800_000_000 });
  }
  if (path.startsWith("invoices/")) return stripeReply({ payments: { data: [{ payment: { payment_intent: "pi_invoice" } }] } });
  if (path.startsWith("payment_intents/")) return stripeReply({ metadata: { plan: "monthly", user_id: STUDENT } });
  throw new Error(`unexpected Stripe call: ${path}`);
});

async function start(fn: "billing-webhook" | "billing-checkout" | "affiliate-admin") {
  vi.resetModules();
  const env: Record<string, string> = { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, SITE_URL: "https://site.test", RESEND_API_KEY: "re_fake" };
  vi.stubGlobal("Deno", { env: { get: (name: string) => env[name] }, serve: (f: typeof handler) => { handler = f; } });
  await import(`../supabase/functions/${fn}/index.ts`);
}

beforeEach(() => {
  vi.resetAllMocks();
  stripeCalls = [];
  emails = [];
  missingCoupons = new Set();
  db = {
    affiliates: [{ id: AFFILIATE, user_id: "creator", email: "creator@test.pl", code: "ANIA", active: true, commission_percent: 15, discount_percent: 20, commission_months: 3 }],
    affiliate_sales: [],
    billing_accounts: [],
    stripe_events: [],
    withdrawals: [],
    app_admins: [],
    affiliate_payouts: [],
  };
  admin.from.mockImplementation(table);
  admin.auth.getUser.mockResolvedValue({ data: { user: { id: STUDENT, email: "student@test" } } });
  fakeStripe.mockImplementation(fakeStripeImpl);
  vi.stubGlobal("fetch", fakeStripe);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
const fakeStripeImpl = fakeStripe.getMockImplementation()!;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("billing-webhook credits the creator", () => {
  let eventNo = 0;
  async function send(type: string, object: Record<string, unknown>) {
    const body = JSON.stringify({ id: `evt_${++eventNo}`, type, data: { object } });
    const t = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
    const res = await handler(new Request("https://example.test/billing-webhook", { method: "POST", headers: { "stripe-signature": `t=${t},v1=${signature}` }, body }));
    expect(res.status).toBe(200);
  }
  const pakiet = (extra = {}) => ({
    id: "cs_1", mode: "payment", payment_status: "paid", customer: "cus_1", amount_total: 10320, payment_intent: "pi_1", created: 1_790_000_000,
    metadata: { plan: "matura", user_id: STUDENT, affiliate_id: AFFILIATE }, ...extra,
  });
  const invoice = (id: string, extra = {}) => ({
    id, customer: "cus_1", amount_paid: 2399, created: 1_790_000_000, status_transitions: { paid_at: 1_790_000_100 },
    parent: { subscription_details: { subscription: "sub_1", metadata: { user_id: STUDENT, affiliate_id: AFFILIATE } } }, ...extra,
  });

  beforeEach(() => start("billing-webhook"));

  it("records a Pakiet bought with a code", async () => {
    await send("checkout.session.completed", pakiet());
    expect(db.affiliate_sales).toEqual([{
      affiliate_id: AFFILIATE, stripe_ref: "cs_1", stripe_customer_id: "cus_1", stripe_subscription_id: null, stripe_payment_intent: "pi_1",
      plan: "matura", amount_paid: 10320, commission_percent: 15, paid_at: new Date(1_790_000_000_000).toISOString(),
    }]);
  });

  it("adds nothing when Stripe sends the same payment again", async () => {
    await send("checkout.session.completed", pakiet());
    await send("checkout.session.async_payment_succeeded", pakiet());
    expect(db.affiliate_sales).toHaveLength(1);
  });

  it("ignores a purchase without a code and one where nothing was paid", async () => {
    await send("checkout.session.completed", pakiet({ metadata: { plan: "matura", user_id: STUDENT } }));
    await send("checkout.session.completed", pakiet({ id: "cs_2", payment_status: "no_payment_required", amount_total: 0 }));
    expect(db.affiliate_sales).toEqual([]);
  });

  it("records a monthly payment with the payment intent from Stripe's payments list", async () => {
    await send("invoice.paid", invoice("in_1"));
    expect(db.affiliate_sales[0]).toMatchObject({ stripe_ref: "in_1", plan: "monthly", amount_paid: 2399, stripe_subscription_id: "sub_1", stripe_payment_intent: "pi_invoice", paid_at: new Date(1_790_000_100_000).toISOString() });
    expect(stripeCalls.find((c) => c.path === "invoices/in_1")!.form.get("expand[0]")).toBe("payments");
  });

  it("stops after the agreed number of paid months", async () => {
    for (const id of ["in_1", "in_2", "in_3", "in_4"]) await send("invoice.paid", invoice(id));
    expect(db.affiliate_sales.map((s) => s.stripe_ref)).toEqual(["in_1", "in_2", "in_3"]);
  });

  it("counts every month when there is no limit", async () => {
    db.affiliates[0].commission_months = null;
    for (const id of ["in_1", "in_2", "in_3", "in_4"]) await send("invoice.paid", invoice(id));
    expect(db.affiliate_sales).toHaveLength(4);
  });

  it("does not look up invoices of students without a code", async () => {
    await send("invoice.paid", invoice("in_1", { parent: { subscription_details: { subscription: "sub_1", metadata: { user_id: STUDENT } } } }));
    expect(db.affiliate_sales).toEqual([]);
    expect(stripeCalls.some((c) => c.path.startsWith("invoices/"))).toBe(false);
  });

  it("lowers the commission of the refunded payment only", async () => {
    await send("invoice.paid", invoice("in_1"));
    db.affiliate_sales.push({ stripe_ref: "cs_other", stripe_payment_intent: "pi_other", refunded_amount: 0 });
    await send("charge.refunded", { payment_intent: "pi_invoice", customer: "cus_1", amount_refunded: 1200 });
    expect(db.affiliate_sales[0].refunded_amount).toBe(1200);
    expect(db.affiliate_sales[1].refunded_amount).toBe(0);
  });
});

describe("billing-checkout takes a creator's code", () => {
  const checkout = (plan: string, code?: string) => handler(new Request("https://example.test/billing-checkout", {
    method: "POST",
    headers: { authorization: "Bearer token", origin: "https://site.test" },
    body: JSON.stringify({ plan, termsVersion: PURCHASE_CONSENT_VERSION, consents: { terms: true, age: true, earlyStart: true }, ...(code ? { code } : {}) }),
  }));
  const session = () => stripeCalls.filter((c) => c.path === "checkout/sessions").at(-1)!.form;

  beforeEach(() => start("billing-checkout"));

  it("applies the discount and marks the sale for the Pakiet", async () => {
    expect((await checkout("matura", " ania ")).status).toBe(200);
    expect(session().get("discounts[0][coupon]")).toBe("kod-20-2580");
    expect(session().get("allow_promotion_codes")).toBeNull();
    expect(session().get("metadata[affiliate_id]")).toBe(AFFILIATE);
    expect(session().get("payment_intent_data[metadata][affiliate_id]")).toBe(AFFILIATE);
  });

  it("marks the subscription, so renewals reach the creator too", async () => {
    expect((await checkout("monthly", "ANIA")).status).toBe(200);
    expect(session().get("discounts[0][coupon]")).toBe("kod-20-1000"); // 24,99 zł − 20% = 19,99 zł
    expect(session().get("subscription_data[metadata][affiliate_id]")).toBe(AFFILIATE);
  });

  it("takes the code off the full price for a returning subscriber", async () => {
    db.billing_accounts.push({ user_id: STUDENT, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_old" });
    await checkout("monthly", "ANIA");
    expect(session().get("discounts[0][coupon]")).toBe("kod-20-600"); // 29,99 zł − 20% = 23,99 zł
  });

  it("credits the creator of a code without a discount", async () => {
    db.affiliates[0].discount_percent = 0;
    await checkout("monthly", "ANIA");
    expect(session().get("discounts[0][coupon]")).toBe("pierwszy-miesiac");
    expect(session().get("metadata[affiliate_id]")).toBe(AFFILIATE);
  });

  it("changes nothing without a code", async () => {
    await checkout("monthly");
    expect(session().get("discounts[0][coupon]")).toBe("pierwszy-miesiac");
    expect(session().get("metadata[affiliate_id]")).toBeNull();
    await checkout("matura");
    expect(session().get("allow_promotion_codes")).toBe("true");
    expect(session().get("discounts[0][coupon]")).toBeNull();
  });

  it("creates the coupon the first time this discount is used", async () => {
    missingCoupons.add("kod-20-2580");
    expect((await checkout("matura", "ANIA")).status).toBe(200);
    const created = stripeCalls.find((c) => c.path === "coupons")!.form;
    expect([created.get("id"), created.get("amount_off"), created.get("currency"), created.get("duration")]).toEqual(["kod-20-2580", "2580", "pln", "once"]);
    expect(session().get("discounts[0][coupon]")).toBe("kod-20-2580");
  });

  it.each([
    ["an unknown code", "NOPE", () => {}],
    ["a malformed code", "a b", () => {}],
    ["a switched-off code", "ANIA", () => { db.affiliates[0].active = false; }],
    ["the buyer's own code", "ANIA", () => { db.affiliates[0].user_id = STUDENT; }],
  ])("refuses %s without opening a payment", async (_, code, arrange) => {
    arrange();
    const res = await checkout("matura", code);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/kod nie działa/);
    expect(stripeCalls).toEqual([]);
  });
});

describe("affiliate-admin manages creators", () => {
  const OWNER = "30000000-0000-4000-8000-000000000003";
  const send = (body: Record<string, unknown>) => handler(new Request("https://example.test/affiliate-admin", {
    method: "POST", headers: { authorization: "Bearer token", origin: "https://site.test" }, body: JSON.stringify(body),
  }));
  const form = (change = {}) => ({
    name: "Bartek", email: " Bartek@Test.pl ", code: "bartek", commissionPercent: 10, discountPercent: 10, commissionMonths: null, active: true,
    platform: "TikTok", profileUrl: "", contact: "", payoutDetails: "", adFee: 30000, startsOn: "", endsOn: "", notes: "2 filmiki", ...change,
  });
  let accounts: { id: string; email: string; has_password: boolean }[];

  beforeEach(async () => {
    db.app_admins.push({ user_id: OWNER });
    admin.auth.getUser.mockResolvedValue({ data: { user: { id: OWNER, email: "owner@test" } } });
    accounts = [{ id: "existing-user", email: "has@account.pl", has_password: true }];
    admin.rpc.mockImplementation(async (name: string, args: { p_email: string }) => {
      expect(name).toBe("auth_user_by_email");
      return { data: accounts.filter((a) => a.email === args.p_email).map(({ id, has_password }) => ({ id, has_password })), error: null };
    });
    admin.auth.admin.createUser.mockImplementation(async ({ email }: { email: string }) => {
      accounts.push({ id: `user-${email}`, email, has_password: false });
      return { data: { user: { id: `user-${email}` } }, error: null };
    });
    admin.auth.admin.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash123" } }, error: null });
    await start("affiliate-admin");
  });

  it("lets only admins in", async () => {
    admin.auth.getUser.mockResolvedValue({ data: { user: { id: STUDENT } } });
    const res = await send({ action: "save", affiliate: form() });
    expect(res.status).toBe(403);
    expect(db.affiliates).toHaveLength(1);
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("adds a creator with a new login and e-mails the link to set a password", async () => {
    const res = await send({ action: "save", affiliate: form() });
    expect(await res.json()).toMatchObject({ ok: true, inviteSent: true });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({ email: "bartek@test.pl", email_confirm: true });
    expect(db.affiliates[1]).toMatchObject({ user_id: "user-bartek@test.pl", email: "bartek@test.pl", code: "BARTEK", commission_percent: 10, discount_percent: 10, ad_fee: 30000, notes: "2 filmiki", profile_url: null });
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "bartek@test.pl" });
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toEqual(["bartek@test.pl"]);
    expect(emails[0].text).toContain("https://site.test/auth/potwierdz?token_hash=hash123&type=recovery&next=%2Fnowe-haslo");
    expect(emails[0].text).toContain("BARTEK");
  });

  it("links an existing account without touching its password", async () => {
    const res = await send({ action: "save", affiliate: form({ email: "has@account.pl" }) });
    expect(await res.json()).toMatchObject({ ok: true, inviteSent: false });
    expect(db.affiliates[1].user_id).toBe("existing-user");
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(emails).toEqual([]);
  });

  it("refuses a code another creator has, before making any login", async () => {
    const res = await send({ action: "save", affiliate: form({ code: "ania" }) });
    expect(res.status).toBe(409);
    expect((await res.json()).fieldErrors).toEqual({ code: "Ten kod ma już inny twórca." });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("shows which fields are wrong", async () => {
    const res = await send({ action: "save", affiliate: form({ email: "nope", commissionPercent: 150 }) });
    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).fieldErrors)).toEqual(["email", "commissionPercent"]);
  });

  it("edits a creator and keeps the login when the e-mail stays", async () => {
    const res = await send({ action: "save", id: AFFILIATE, affiliate: form({ name: "Ania", email: "creator@test.pl", code: "ania", commissionPercent: 12, active: false }) });
    expect(await res.json()).toMatchObject({ ok: true, id: AFFILIATE, inviteSent: false });
    expect(db.affiliates).toHaveLength(1);
    expect(db.affiliates[0]).toMatchObject({ user_id: "creator", commission_percent: 12, active: false });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(emails).toEqual([]);
  });

  it("moves the panel to a new e-mail and invites that address", async () => {
    await send({ action: "save", id: AFFILIATE, affiliate: form({ email: "nowy@test.pl", code: "ania" }) });
    expect(db.affiliates[0].user_id).toBe("user-nowy@test.pl");
    expect(emails[0].to).toEqual(["nowy@test.pl"]);
  });

  it("sends the password link again", async () => {
    const res = await send({ action: "invite", id: AFFILIATE });
    expect(res.status).toBe(200);
    expect(emails[0].to).toEqual(["creator@test.pl"]);
  });

  it("records and removes a payout", async () => {
    const res = await send({ action: "payout", payout: { affiliateId: AFFILIATE, amount: 6240, paidOn: "2026-11-15", note: "BLIK" } });
    expect(res.status).toBe(200);
    expect(db.affiliate_payouts[0]).toMatchObject({ affiliate_id: AFFILIATE, amount: 6240, note: "BLIK", paid_at: "2026-11-15T12:00:00Z" });
    expect((await send({ action: "deletePayout", id: db.affiliate_payouts[0].id })).status).toBe(200);
    expect(db.affiliate_payouts).toEqual([]);
  });

  it("refuses an empty payout", async () => {
    const res = await send({ action: "payout", payout: { affiliateId: AFFILIATE, amount: 0, paidOn: "2026-11-15", note: "" } });
    expect((await res.json()).fieldErrors).toHaveProperty("amount");
    expect(db.affiliate_payouts).toEqual([]);
  });
});
