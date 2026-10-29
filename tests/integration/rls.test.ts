// Security test against the REAL Supabase project: proves RLS actually protects student data.
// It creates two throwaway accounts, checks what each can and can't do, then deletes them.
// Run after every database change: `npm run test:integration`.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const newClient = (): Client =>
  createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });

const run = Date.now().toString(36);
const password = "Test12345abc";

async function signUp(label: string) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `rls-${label}-${run}@ogarnijmature-test.pl`,
    password,
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.user || !data.session) throw new Error(`signup failed: ${error?.message}`);
  return { client, id: data.user.id };
}

let a: { client: Client; id: string };
let b: { client: Client; id: string };
const anon = newClient();

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
});

afterAll(async () => {
  // Clean up: each test user deletes their own account.
  await a?.client.rpc("delete_my_account");
  await b?.client.rpc("delete_my_account");
});

describe("profiles RLS", () => {
  it("creates a profile automatically on signup", async () => {
    const { data } = await a.client.from("profiles").select("*").eq("id", a.id).single();
    expect(data?.terms_version).toBe(TERMS_VERSION);
    expect(data?.age_confirmed).toBe(true);
  });

  it("a student sees only their own profile", async () => {
    const { data } = await a.client.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([a.id]);
  });

  it("a student cannot change someone else's profile", async () => {
    const { data } = await a.client.from("profiles").update({ display_name: "hacked" }).eq("id", b.id).select();
    expect(data).toEqual([]);
    const { data: bProfile } = await b.client.from("profiles").select("display_name").eq("id", b.id).single();
    expect(bProfile?.display_name).not.toBe("hacked");
  });

  it("a student can update allowed fields but not their consent record", async () => {
    const ok = await a.client.from("profiles").update({ display_name: "Ala" }).eq("id", a.id);
    expect(ok.error).toBeNull();
    // terms_version is not in the column grant, so Postgres refuses the update.
    const bad = await a.client
      .from("profiles")
      .update({ terms_version: "fake" } as never)
      .eq("id", a.id);
    expect(bad.error).not.toBeNull();
  });

  it("logged-out visitors can't read profiles or the waitlist", async () => {
    const profiles = await anon.from("profiles").select("id");
    expect(profiles.data ?? []).toEqual([]);
    const waitlist = await anon.from("waitlist_signups").select("email");
    expect(waitlist.data ?? []).toEqual([]);
  });

  it("logged-out visitors can't call delete_my_account", async () => {
    const { error } = await anon.rpc("delete_my_account");
    expect(error).not.toBeNull();
  });
});

describe("signup rules", () => {
  it("refuses to create an account without terms acceptance", async () => {
    const { error } = await newClient().auth.signUp({
      email: `rls-noterms-${run}@ogarnijmature-test.pl`,
      password,
    });
    expect(error).not.toBeNull();
  });
});
