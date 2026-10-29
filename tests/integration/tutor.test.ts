// Security tests for the AI tutor against the REAL project: chats are written only by the
// Edge Function, it requires a login, and bad requests stop before the AI call.
// These tests never reach OpenAI (no cost).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const newClient = (): Client =>
  createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });

const run = Date.now().toString(36);
let a: { client: Client; id: string; token: string };

beforeAll(async () => {
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: `tutor-a-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  a = { client, id: data.user.id, token: data.session.access_token };
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
});

const url = `${SUPABASE.url}/functions/v1/tutor-chat`;
const post = (body: unknown, token?: string) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe("tutor tables", () => {
  it("students can't write chats or messages directly", async () => {
    const { error: chatError } = await a.client.from("tutor_chats").insert({ user_id: a.id, title: "x" });
    expect(chatError).not.toBeNull();
    const { error: msgError } = await a.client
      .from("tutor_messages")
      .insert({ chat_id: crypto.randomUUID(), user_id: a.id, role: "assistant", content: "fake reply" });
    expect(msgError).not.toBeNull();
  });
});

describe("tutor-chat function", () => {
  it("rejects requests without a login", async () => {
    const res = await post({ message: "Cześć" });
    expect(res.status).toBe(401);
  });

  it("rejects bad requests before using AI", async () => {
    expect((await post({ message: "" }, a.token)).status).toBe(400);
    expect((await post({ message: "x".repeat(2001) }, a.token)).status).toBe(400);
    expect((await post({ message: "Hej", examId: "2026-maj-polski-pp" }, a.token)).status).toBe(400); // no groupNo
  });

  it("refuses chats and tasks that don't exist (or aren't yours)", async () => {
    expect((await post({ message: "Hej", chatId: crypto.randomUUID() }, a.token)).status).toBe(404);
    expect((await post({ message: "Hej", examId: "2099-maj-polski-pp", groupNo: 1 }, a.token)).status).toBe(404);
    expect((await post({ message: "Hej", examId: "2026-maj-polski-pp", groupNo: 99 }, a.token)).status).toBe(404);
  });

  it("saved nothing and used no daily quota", async () => {
    const { data: chats } = await a.client.from("tutor_chats").select("id");
    expect(chats).toEqual([]);
    const { data: usage } = await a.client.from("ai_usage").select("count");
    expect(usage).toEqual([]);
  });
});
