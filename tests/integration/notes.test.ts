// Security tests for AI notes against the REAL project: notes are written only by the Edge Function,
// it requires a login, and bad requests stop before the AI call. These tests never reach OpenAI (no cost).

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
    email: `notes-a-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  a = { client, id: data.user.id, token: data.session.access_token };
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
});

const url = `${SUPABASE.url}/functions/v1/notes-generate`;
const post = (body: unknown, token?: string) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe("notes table", () => {
  it("students can't write notes directly", async () => {
    const { error } = await a.client
      .from("notes")
      .insert({ user_id: a.id, subject: "polish", source_kind: "text", status: "done", note: {} });
    expect(error).not.toBeNull();
  });
});

describe("notes-generate function", () => {
  it("rejects requests without a login", async () => {
    expect((await post({ subject: "polish", text: "x".repeat(100) })).status).toBe(401);
  });

  it("rejects bad requests before using AI", async () => {
    expect((await post({ subject: "polish", text: "za mało" }, a.token)).status).toBe(400);
    expect((await post({ subject: "biology", text: "x".repeat(100) }, a.token)).status).toBe(400);
    expect((await post({ subject: "polish", images: ["data:text/html;base64,PGI+"] }, a.token)).status).toBe(400);
  });

  it("saved nothing and used no daily quota", async () => {
    const { data: notes } = await a.client.from("notes").select("id");
    expect(notes).toEqual([]);
    const { data: usage } = await a.client.from("ai_usage").select("count");
    expect(usage).toEqual([]);
  });
});
