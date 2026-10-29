// Security tests for 👍/👎 on AI answers (ai_ratings) against the REAL project: students can rate
// only AI output they own, can't see other students' ratings, and values are checked. No AI calls.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const run = Date.now().toString(36);
let a: { client: Client; id: string };
let b: { client: Client; id: string };
let aiDeck: string; // made "by AI" (source_kind text): can be rated
let manualDeck: string; // typed by hand: nothing to rate

async function signUp(tag: string) {
  const client = createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `ratings-${tag}-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  return { client, id: data.user.id };
}

beforeAll(async () => {
  [a, b] = await Promise.all([signUp("a"), signUp("b")]);
  const { data: d1 } = await a.client
    .from("flashcard_decks")
    .insert({ user_id: a.id, title: "AI", source_kind: "text" })
    .select("id")
    .single();
  const { data: d2 } = await a.client.from("flashcard_decks").insert({ user_id: a.id, title: "Ręczna" }).select("id").single();
  aiDeck = d1!.id;
  manualDeck = d2!.id;
});

afterAll(async () => {
  await Promise.all([a?.client.rpc("delete_my_account"), b?.client.rpc("delete_my_account")]);
});

const rate = (c: Client, target_kind: string, target_id: string, rating: number, comment = "") =>
  c.from("ai_ratings").upsert(
    { target_kind, target_id, rating, comment },
    { onConflict: "user_id,target_kind,target_id" },
  );

describe("ai_ratings", () => {
  it("lets a student rate their own AI deck and change their mind", async () => {
    expect((await rate(a.client, "deck", aiDeck, 1)).error).toBeNull();
    expect((await rate(a.client, "deck", aiDeck, -1, "za mało fiszek")).error).toBeNull();
    const { data } = await a.client.from("ai_ratings").select("rating, comment, user_id");
    expect(data).toEqual([{ rating: -1, comment: "za mało fiszek", user_id: a.id }]);
  });

  it("refuses things that aren't AI output or aren't yours", async () => {
    expect((await rate(a.client, "deck", manualDeck, 1)).error).not.toBeNull();
    expect((await rate(b.client, "deck", aiDeck, 1)).error).not.toBeNull();
    expect((await rate(a.client, "essay", crypto.randomUUID(), 1)).error).not.toBeNull();
    expect((await rate(a.client, "tutor_message", "1", 1)).error).not.toBeNull();
  });

  it("checks the values", async () => {
    expect((await rate(a.client, "deck", aiDeck, 5)).error).not.toBeNull();
    expect((await rate(a.client, "whatever", aiDeck, 1)).error).not.toBeNull();
    expect((await rate(a.client, "deck", aiDeck, -1, "x".repeat(501))).error).not.toBeNull();
  });

  it("can't rate in someone else's name", async () => {
    const { error } = await b.client
      .from("ai_ratings")
      .insert({ user_id: a.id, target_kind: "deck", target_id: aiDeck, rating: 1 });
    expect(error).not.toBeNull();
  });

  it("other students can't see your ratings", async () => {
    const { data } = await b.client.from("ai_ratings").select("id");
    expect(data).toEqual([]);
  });
});
