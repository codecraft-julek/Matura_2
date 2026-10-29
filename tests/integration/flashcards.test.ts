// Security tests for flashcards against the REAL project: students edit only their own decks,
// can't put cards into someone else's deck, and the AI function refuses bad input (including
// links to internal addresses) before using AI. These tests never reach OpenAI (no cost).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUPABASE, TERMS_VERSION } from "@/config/site";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type User = { client: Client; id: string; token: string };
const run = Date.now().toString(36);

async function signUp(label: string): Promise<User> {
  const client = createClient<Database>(SUPABASE.url, SUPABASE.publishableKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `cards-${label}-${run}@ogarnijmature-test.pl`,
    password: "Test12345abc",
    options: { data: { terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error || !data.session || !data.user) throw new Error(`signup failed: ${error?.message}`);
  return { client, id: data.user.id, token: data.session.access_token };
}

let a: User;
let b: User;
let deckA: string;

beforeAll(async () => {
  [a, b] = await Promise.all([signUp("a"), signUp("b")]);
});

afterAll(async () => {
  await a?.client.rpc("delete_my_account");
  await b?.client.rpc("delete_my_account");
});

describe("decks and cards (RLS)", () => {
  it("a student can make a deck and add cards to it", async () => {
    const { data, error } = await a.client.from("flashcard_decks").insert({ user_id: a.id, title: "Test" }).select("id").single();
    expect(error).toBeNull();
    deckA = data!.id;
    const { error: cardError } = await a.client.from("flashcards").insert({ deck_id: deckA, user_id: a.id, front: "Q", back: "A" });
    expect(cardError).toBeNull();
  });

  it("another student can't see the deck or its cards", async () => {
    const { data: decks } = await b.client.from("flashcard_decks").select("id").eq("id", deckA);
    expect(decks).toEqual([]);
    const { data: cards } = await b.client.from("flashcards").select("id").eq("deck_id", deckA);
    expect(cards).toEqual([]);
  });

  it("another student can't add cards to it, even with their own user id", async () => {
    const { error } = await b.client.from("flashcards").insert({ deck_id: deckA, user_id: b.id, front: "spam", back: "spam" });
    expect(error).not.toBeNull();
  });

  it("no one can create rows in someone else's name", async () => {
    const { error } = await b.client.from("flashcard_decks").insert({ user_id: a.id, title: "fake" });
    expect(error).not.toBeNull();
  });

  it("another student can't change or delete it", async () => {
    await b.client.from("flashcard_decks").update({ title: "hacked" }).eq("id", deckA);
    await b.client.from("flashcard_decks").delete().eq("id", deckA);
    const { data } = await a.client.from("flashcard_decks").select("title").eq("id", deckA).single();
    expect(data?.title).toBe("Test");
  });
});

describe("flashcards-generate function", () => {
  const url = `${SUPABASE.url}/functions/v1/flashcards-generate`;
  const post = (body: unknown, token?: string) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

  it("rejects requests without a login", async () => {
    expect((await post({ subject: "polish", kind: "text", text: "x".repeat(100) })).status).toBe(401);
  });

  it("rejects bad input before using AI", async () => {
    expect((await post({ subject: "polish", kind: "text", text: "za mało" }, a.token)).status).toBe(400);
    expect((await post({ subject: "polish", kind: "url", url: "http://169.254.169.254/latest" }, a.token)).status).toBe(400);
    expect((await post({ subject: "polish", kind: "youtube", url: "https://vimeo.com/1", text: "x".repeat(100) }, a.token)).status).toBe(400);
  });

  it("refuses domains that point at internal addresses", async () => {
    // localtest.me resolves to 127.0.0.1
    expect((await post({ subject: "other", kind: "url", url: "http://localtest.me/" }, a.token)).status).toBe(422);
  });

  it("used no daily quota", async () => {
    const { data } = await a.client.from("ai_usage").select("count");
    expect(data).toEqual([]);
  });
});
