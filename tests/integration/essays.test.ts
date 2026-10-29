// Security tests for AI essay feedback against the REAL project:
// essays are private, quota can't be touched by students, the function requires a login.
// These tests never reach OpenAI (no cost): they only hit the checks that run before the AI call.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const newClient = (): Client =>
  createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });

const run = Date.now().toString(36);
async function signUp(label: string) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `essay-${label}-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  return { client, id: data.user.id };
}

let a: { client: Client; id: string };
let b: { client: Client; id: string };

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
  await b?.client.rpc("delete_my_account");
});

describe("essays table", () => {
  it("students can't insert essays directly (only the Edge Function can)", async () => {
    const { error } = await a.client
      .from("essays")
      .insert({ user_id: a.id, kind: "polish_essay", level: "basic", content: "x", word_count: 1 });
    expect(error).not.toBeNull();
  });

  it("students can't touch the AI quota", async () => {
    const { error } = await a.client.rpc("consume_ai_quota", {
      p_user: a.id,
      p_feature: "essay_feedback",
      p_user_limit: 999,
      p_global_limit: 999,
    });
    expect(error).not.toBeNull();
  });
});

describe("essay-feedback function", () => {
  const url = `${SUPABASE.url}/functions/v1/essay-feedback`;
  const body = JSON.stringify({ mode: "polish", topic: "Czy warto być lojalnym?", content: "za krótko" });

  it("rejects requests without a login", async () => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(res.status).toBe(401);
  });

  it("rejects a too-short text before using AI, and saves nothing", async () => {
    const { data } = await a.client.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session!.access_token}` },
      body,
    });
    expect(res.status).toBe(400);
    const { data: essays } = await a.client.from("essays").select("id");
    expect(essays).toEqual([]);
    const { data: usage } = await a.client.from("ai_usage").select("count");
    expect(usage).toEqual([]); // no daily check was used
  });

  it("finds the essay of a Polish extended attempt (and still checks its length first)", async () => {
    const { data: attemptId, error } = await a.client.rpc("submit_exam_attempt", {
      p_exam_id: "2023-maj-polski-pr",
      p_mode: "practice",
      p_answers: { "1": "Za krótkie wypracowanie." },
      p_started_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(error).toBeNull();
    const { data } = await a.client.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session!.access_token}` },
      body: JSON.stringify({ mode: "exam", attemptId, taskNumber: "1" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/za krótki/);
    const { data: usage } = await a.client.from("ai_usage").select("count");
    expect(usage).toEqual([]);
  });

  it("validates the request before doing anything", async () => {
    const { data } = await b.client.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session!.access_token}` },
      body: JSON.stringify({ mode: "polish", topic: "", content: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
