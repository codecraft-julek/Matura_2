// Security tests for payments against the REAL project: students can't give themselves Premium,
// only Stripe-signed webhooks change billing, and limits come from plan_limits. No Stripe calls
// that cost anything: these requests are all refused before reaching Stripe.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const run = Date.now().toString(36);
let a: { client: Client; id: string; token: string };

beforeAll(async () => {
  const client = createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `billing-a-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  a = { client, id: data.user.id, token: data.session.access_token };
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
});

const fn = (name: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${SUPABASE.url}/functions/v1/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE.publishableKey, ...headers },
    body: JSON.stringify(body),
  });

describe("billing tables", () => {
  it("students can't give themselves Premium", async () => {
    const far = "2099-01-01T00:00:00Z";
    const { error: insertError } = await a.client.from("billing_accounts").insert({ user_id: a.id, pass_until: far });
    expect(insertError).not.toBeNull();
    const { data: rows } = await a.client.from("billing_accounts").select("user_id");
    expect(rows).toEqual([]);
    const { error: eventError } = await a.client.from("stripe_events").insert({ id: `evt_fake_${run}`, type: "x" });
    expect(eventError).not.toBeNull();
  });

  it("plan helpers that take a user id are not callable from the website", async () => {
    expect((await a.client.rpc("user_plan", { p_user: a.id })).error).not.toBeNull();
    const { error } = await a.client.rpc("consume_plan_quota", { p_user: a.id, p_feature: "notes", p_global_limit: 9 });
    expect(error).not.toBeNull();
  });

  it("limits are public, and a new student gets the free ones", async () => {
    const anon = createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });
    const { data: limits } = await anon.from("plan_limits").select("plan, feature");
    expect(limits?.length).toBeGreaterThanOrEqual(10);

    const { data: mine, error } = await a.client.rpc("my_ai_allowance");
    expect(error).toBeNull();
    expect(mine?.every((r) => r.plan === "free" && r.used === 0)).toBe(true);
    expect(mine?.find((r) => r.feature === "essay_feedback")).toMatchObject({ period: "week" });
  });
});

describe("billing functions", () => {
  it("checkout and the portal need a login", async () => {
    expect((await fn("billing-checkout", { plan: "monthly" })).status).toBe(401);
    expect((await fn("billing-portal", {})).status).toBe(401);
  });

  it("checkout refuses a plan without the consents (or says payments aren't on yet)", async () => {
    const res = await fn("billing-checkout", { plan: "matura", consents: { terms: true } }, { authorization: `Bearer ${a.token}` });
    expect([400, 503]).toContain(res.status);
    expect((await res.json()).ok).toBe(false);
  });

  it("the webhook ignores anything not signed by Stripe", async () => {
    const forged = {
      id: `evt_forged_${run}`,
      type: "checkout.session.completed",
      data: { object: { mode: "payment", payment_status: "paid", metadata: { user_id: a.id, plan: "matura" } } },
    };
    const res = await fn("billing-webhook", forged, { "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` });
    expect([400, 503]).toContain(res.status);
    const { data } = await a.client.from("billing_accounts").select("pass_until");
    expect(data).toEqual([]);
  });
});
