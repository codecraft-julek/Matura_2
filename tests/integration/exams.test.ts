// Security + grading tests for past exams against the REAL Supabase project.
// Proves: answer keys can't be read, grading works, attempts are private.
// Needs the 2025 English basic exam to be synced (`npm run content:sync`).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const EXAM = "2025-maj-angielski-pp";
const newClient = (): Client =>
  createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });

const run = Date.now().toString(36);
async function signUp(label: string) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `exam-${label}-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`signup failed: ${error?.message}`);
  return client;
}

let a: Client;
let b: Client;
let attemptId: string;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
});

afterAll(async () => {
  await a?.rpc("delete_my_account");
  await b?.rpc("delete_my_account");
});

describe("exam content access", () => {
  it("logged-in students can read exams and tasks", async () => {
    const { data } = await a.from("exam_tasks").select("number, kind").eq("exam_id", EXAM);
    expect(data?.length).toBe(49);
  });

  it("nobody can read the answer keys directly", async () => {
    const { data } = await a.from("exam_task_keys").select("*").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("logged-out visitors see no exams and can't grade", async () => {
    const anon = newClient();
    const { data } = await anon.from("exams").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.rpc("grade_exam_answers", { p_exam_id: EXAM, p_answers: {} });
    expect(error).not.toBeNull();
  });
});

describe("grading", () => {
  it("grades one group without leaking other groups' keys", async () => {
    const { data, error } = await a.rpc("grade_exam_answers", {
      p_exam_id: EXAM,
      p_answers: { "1.1": "b", "1.2": "A", "3.1": "x" },
      p_group: 1,
    });
    expect(error).toBeNull();
    const r = data as Record<string, { status: string; points: number }>;
    expect(Object.keys(r).sort()).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5"]);
    expect(r["1.1"]).toMatchObject({ status: "correct", points: 1 }); // lowercase letter is fine
    expect(r["1.2"]).toMatchObject({ status: "incorrect", points: 0 });
    expect(r["1.3"].status).toBe("empty");
  });

  it("grades True/False tasks (2023 basic, task 1)", async () => {
    const { data, error } = await a.rpc("grade_exam_answers", {
      p_exam_id: "2023-maj-angielski-pp",
      p_answers: { "1.1": "t", "1.2": "T" },
      p_group: 1,
    });
    expect(error).toBeNull();
    const r = data as Record<string, { status: string }>;
    expect(r["1.1"].status).toBe("correct");
    expect(r["1.2"].status).toBe("incorrect");
  });

  it("gives partial points for multi-row Polish tasks", async () => {
    // 2026 task 1: three P/F rows (key PPP), 2 pts, minus one per wrong row
    const grade = async (answer: string) => {
      const { data, error } = await a.rpc("grade_exam_answers", {
        p_exam_id: "2026-maj-polski-pp",
        p_answers: { "1": answer },
        p_group: 1,
      });
      expect(error).toBeNull();
      return (data as Record<string, { status: string; points: number }>)["1"];
    };
    expect(await grade("ppp")).toMatchObject({ status: "correct", points: 2 });
    expect(await grade("PFP")).toMatchObject({ status: "partial", points: 1 });
    expect(await grade("P_F")).toMatchObject({ status: "incorrect", points: 0 }); // "_" = unanswered row
    expect((await grade("___")).status).toBe("empty");
  });

  it("normalises open answers like the app does", async () => {
    const { data } = await a.rpc("grade_exam_answers", {
      p_exam_id: EXAM,
      p_answers: { "3.1": "  Three  Weeks. ", "3.2": "healthy food", "3.3": "in a tent" },
      p_group: 3,
    });
    const r = data as Record<string, { status: string }>;
    expect(r["3.1"].status).toBe("correct");
    expect(r["3.2"].status).toBe("correct");
    expect(r["3.3"].status).toBe("unchecked"); // not in the list: student self-checks
  });

  it("saves an attempt with the right score", async () => {
    const { data, error } = await a.rpc("submit_exam_attempt", {
      p_exam_id: EXAM,
      p_mode: "exam",
      p_answers: { "1.1": "B", "1.2": "D", "3.3": "in a tent", "12": "My first concert was great." },
      p_started_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(error).toBeNull();
    attemptId = data as string;
    const { data: attempt } = await a.from("exam_attempts").select("score, checkable_points, results").eq("id", attemptId).single();
    expect(attempt?.score).toBe(2);
    expect(attempt?.checkable_points).toBe(48);
    expect((attempt?.results as Record<string, { status: string }>)["12"].status).toBe("writing");
  });

  it("saves a Polish extended attempt: one essay, nothing to auto-grade", async () => {
    const { data, error } = await b.rpc("submit_exam_attempt", {
      p_exam_id: "2025-maj-polski-pr",
      p_mode: "practice",
      p_answers: { "1": "Moje wypracowanie." },
      p_started_at: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(error).toBeNull();
    const { data: attempt } = await b.from("exam_attempts").select("score, checkable_points, results").eq("id", data as string).single();
    expect(attempt).toMatchObject({ score: 0, checkable_points: 0 });
    expect((attempt?.results as Record<string, { status: string; max: number }>)["1"]).toMatchObject({ status: "writing", max: 35 });
  });

  it("self-check updates the score, but only for unchecked open answers", async () => {
    expect((await a.rpc("self_check_answer", { p_attempt_id: attemptId, p_number: "3.3", p_accept: true })).error).toBeNull();
    const { data } = await a.from("exam_attempts").select("score").eq("id", attemptId).single();
    expect(data?.score).toBe(3);
    // A wrong closed answer can't be "self-accepted".
    const cheat = await a.rpc("self_check_answer", { p_attempt_id: attemptId, p_number: "1.3", p_accept: true });
    expect(cheat.error).not.toBeNull();
  });

  it("another student can't see or change the attempt", async () => {
    const { data } = await b.from("exam_attempts").select("id").eq("id", attemptId);
    expect(data ?? []).toEqual([]);
    const { error } = await b.rpc("self_check_answer", { p_attempt_id: attemptId, p_number: "3.3", p_accept: false });
    expect(error).not.toBeNull();
  });
});
