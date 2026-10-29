// Security tests for AI grading of open answers (grade-open-answers) against the REAL project.
// These tests never reach OpenAI (no cost): they only hit the checks that run before the AI call.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const POLISH = "2025-maj-polski-pp";
const ENGLISH = "2025-maj-angielski-pp";
const url = `${SUPABASE.url}/functions/v1/grade-open-answers`;
const newClient = (): Client =>
  createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });

const run = Date.now().toString(36);
async function signUp(label: string) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `grade-${label}-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  return { client, id: data.user.id, token: data.session.access_token };
}

async function submit(client: Client, examId: string, answers: Record<string, string>) {
  const { data, error } = await client.rpc("submit_exam_attempt", {
    p_exam_id: examId,
    p_mode: "practice",
    p_answers: answers,
    p_started_at: new Date().toISOString(),
  });
  if (error || !data) throw new Error(`submit failed: ${error?.message}`);
  return data;
}

const call = (token: string | null, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

let a: Awaited<ReturnType<typeof signUp>>;
let b: Awaited<ReturnType<typeof signUp>>;
let polishAttempt: string;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
  polishAttempt = await submit(a.client, POLISH, { "1": "Moja odpowiedź otwarta.", "2": "Druga odpowiedź." });
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
  await b?.client.rpc("delete_my_account");
});

describe("save_ai_grades", () => {
  it("students can't save AI grades themselves (only the Edge Function can)", async () => {
    const { error } = await a.client.rpc("save_ai_grades", {
      p_attempt_id: polishAttempt,
      p_user: a.id,
      p_grades: [{ number: "1", points: 1, reason: "x", uncertain: false }],
    });
    expect(error).not.toBeNull();
    const { data } = await a.client.from("exam_attempts").select("results, ai_graded_at").eq("id", polishAttempt).single();
    expect((data!.results as Record<string, { status: string }>)["1"].status).toBe("unchecked");
    expect(data!.ai_graded_at).toBeNull();
  });

  it("students can't use the open-grading quota directly", async () => {
    const { error } = await a.client.rpc("consume_ai_quota", {
      p_user: a.id,
      p_feature: "open_grading",
      p_user_limit: 999,
      p_global_limit: 999,
    });
    expect(error).not.toBeNull();
  });
});

describe("grade-open-answers function", () => {
  it("rejects requests without a login", async () => {
    const res = await call(null, { attemptId: polishAttempt });
    expect(res.status).toBe(401);
  });

  it("validates the request", async () => {
    expect((await call(a.token, { attemptId: "not-a-uuid" })).status).toBe(400);
    expect((await call(a.token, "{not json")).status).toBe(400);
  });

  it("won't grade someone else's attempt", async () => {
    const res = await call(b.token, { attemptId: polishAttempt });
    expect(res.status).toBe(404);
  });

  it("only grades Polish exams", async () => {
    const english = await submit(a.client, ENGLISH, { "3.1": "something" });
    const res = await call(a.token, { attemptId: english });
    expect(res.status).toBe(400);
  });

  it("refuses an attempt with no open answers, without using the daily limit", async () => {
    const empty = await submit(b.client, POLISH, {});
    const res = await call(b.token, { attemptId: empty });
    expect(res.status).toBe(400);
    const { data: usage } = await b.client.from("ai_usage").select("count");
    expect(usage).toEqual([]);
  });
});
