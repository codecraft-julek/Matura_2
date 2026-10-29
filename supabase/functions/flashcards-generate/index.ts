// Supabase Edge Function: POST /functions/v1/flashcards-generate
//   body: { subject, kind, label?, text?, images?, url?, count?, style? }   (see _shared/flashcards.ts)
//
// AI flashcards from a PDF / Word / PowerPoint (text extracted in the browser), photos, a website,
// a YouTube video (transcript fetched via ScrapeCreators, or pasted) or pasted text. Flow: check login → validate → (website: fetch the page
// safely) → check daily limit → ask OpenAI (streamed, strict JSON) → our rules → save the deck.
// Photos and files are never stored; only the cards are.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY                   required for real cards
//   AI_FLASHCARDS_MODEL              optional, default below (falls back to OPENAI_MODEL); must accept images
//   AI_FLASHCARDS_GLOBAL_DAILY_LIMIT optional, decks for ALL students per day (default 1000) → caps your bill
//   AI_REASONING_EFFORT              optional, "low" (default), "medium" or "high"
//   SCRAPECREATORS_API_KEY           optional, fetches YouTube transcripts from a link (without it, students paste them)
//   AI_FAKE_MODE                     "true" = example cards without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  FLASHCARD_LIMITS,
  NoCardsError,
  aiCardsSchema,
  buildCardsInput,
  buildCardsInstructions,
  flashcardRequestSchema,
  htmlToText,
  isPrivateAddress,
  isSafePublicUrl,
  normalizeCards,
  openAiCardsSchema,
  type AiCards,
} from "../_shared/flashcards.ts";

const DEFAULT_MODEL = "gpt-6.1-sol";
const OPENAI_TIMEOUT_MS = 120_000;
const PAGE_TIMEOUT_MS = 10_000;
const PAGE_MAX_BYTES = 3_000_000;
const TRANSCRIPT_TIMEOUT_MS = 30_000;
const FEATURE = "flashcards";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reply = { ok: true; id: string } | { ok: false; error: string };
function json(body: Reply, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("flashcards-generate crashed:", err);
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie za chwilę." }, 500);
  }
});

class UserError extends Error {}

async function handle(request: Request) {
  // 1. Who is asking?
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  // 2. Validate
  const raw = await request.text();
  if (raw.length > FLASHCARD_LIMITS.images * FLASHCARD_LIMITS.imageChars + FLASHCARD_LIMITS.textChars * 2 + 4000) {
    return json({ ok: false, error: "Za dużo danych naraz. Spróbuj z mniejszym plikiem albo mniejszą liczbą zdjęć." }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400);
  }
  const parsed = flashcardRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return json(
      {
        ok: false,
        error:
          msg === "too_little"
            ? "Za mało materiału. Dodaj więcej tekstu albo inny plik."
            : msg === "bad_url"
              ? "Ten link nie wygląda dobrze. Sprawdź adres (musi zaczynać się od https://)."
              : "Nieprawidłowe dane.",
      },
      400,
    );
  }
  const req = parsed.data;
  let text = req.text;
  let label = req.label;

  // 3. Websites: we fetch the page. YouTube: the title here; the transcript after the daily limit (it costs credits).
  try {
    if (req.kind === "url") {
      const page = await fetchPage(req.url!);
      text = page.text.slice(0, FLASHCARD_LIMITS.textChars);
      label = page.title || new URL(req.url!).hostname;
      if (text.length < 200) {
        throw new UserError(
          "Nie udało się odczytać treści tej strony (może wymaga logowania albo ładuje się dopiero w przeglądarce). Skopiuj tekst ze strony i wklej go w zakładce „Tekst”.",
        );
      }
    } else if (req.kind === "youtube") {
      label = (await youtubeTitle(req.url!)) || label || "Film z YouTube";
    }
  } catch (err) {
    if (err instanceof UserError) return json({ ok: false, error: err.message }, 422);
    throw err;
  }

  // 4. Is AI available?
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Fiszki AI jeszcze nie są skonfigurowane. Spróbuj trochę później." }, 503);
  }

  // 5. Daily limits
  const globalLimit = Number(Deno.env.get("AI_FLASHCARDS_GLOBAL_DAILY_LIMIT") ?? 1000);
  // The student's limit depends on their plan (table plan_limits); the global cap protects the bill.
  const { data: quota, error: quotaError } = await admin.rpc("consume_plan_quota", {
    p_user: user.id,
    p_feature: FEATURE,
    p_global_limit: globalLimit,
  });
  if (quotaError) throw quotaError;
  if (!(quota as QuotaResult).allowed) {
    return json({ ok: false, error: quotaMessage(FEATURE, quota as QuotaResult) }, 429);
  }

  // 5b. YouTube without a pasted transcript: fetch it (paid per video, so only after the limit check).
  if (req.kind === "youtube" && text.length < FLASHCARD_LIMITS.minTextChars) {
    try {
      text = await fetchTranscript(req.url!);
    } catch (err) {
      await admin.rpc("refund_ai_quota", { p_user: user.id, p_feature: FEATURE }); // the try doesn't count
      if (err instanceof UserError) return json({ ok: false, error: err.message }, 422);
      throw err;
    }
  }

  const job: Job = {
    userId: user.id,
    subject: req.subject,
    kind: req.kind,
    label: label.slice(0, 300),
    text,
    images: req.images,
    count: req.count,
    style: req.style,
    fake,
    apiKey,
    model: fake ? "fake" : (Deno.env.get("AI_FLASHCARDS_MODEL") ?? Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL),
  };

  // 6a. Streaming (what the website uses): progress as Server-Sent Events.
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // If the student closes the page, sending fails, but the deck is still made and saved.
        let open = true;
        const write = (chunk: string) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            open = false;
          }
        };
        const send = (event: StreamEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
        const ping = setInterval(() => write(": ping\n\n"), 5000);
        send({ type: "start" });
        let last = 0;
        const result = await runJob(job, (chars) => {
          if (chars - last >= 300) {
            last = chars;
            send({ type: "progress", chars });
          }
        });
        clearInterval(ping);
        send(result.ok ? { type: "done", id: result.id } : { type: "error", error: result.error });
        if (open) controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 6b. Plain JSON (tests and simple clients)
  const result = await runJob(job, () => {});
  return result.ok ? json({ ok: true, id: result.id }) : json({ ok: false, error: result.error }, 502);
}

type StreamEvent =
  | { type: "start" }
  | { type: "progress"; chars: number }
  | { type: "done"; id: string }
  | { type: "error"; error: string };

type Job = {
  userId: string;
  subject: "polish" | "english" | "other";
  kind: (typeof import("../_shared/flashcards.ts").AI_SOURCES)[number];
  label: string;
  text: string;
  images: string[];
  count: number;
  style: "auto" | "qa" | "vocab";
  fake: boolean;
  apiKey: string | undefined;
  model: string;
};

/** Asks the AI, applies our rules and saves the deck. Never throws. */
async function runJob(job: Job, onProgress: (chars: number) => void): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const ai = job.fake ? fakeCards(job.count) : await askOpenAI(job, onProgress);
    const { title, cards } = normalizeCards(ai, Math.min(job.count + 5, 40));

    const { data: deck, error: deckError } = await admin
      .from("flashcard_decks")
      .insert({ user_id: job.userId, title, subject: job.subject, source_kind: job.kind, source_label: job.label })
      .select("id")
      .single();
    if (deckError) throw deckError;
    const { error: cardsError } = await admin
      .from("flashcards")
      .insert(cards.map((c, i) => ({ deck_id: deck.id, user_id: job.userId, front: c.front, back: c.back, position: i })));
    if (cardsError) {
      await admin.from("flashcard_decks").delete().eq("id", deck.id);
      throw cardsError;
    }
    return { ok: true, id: deck.id as string };
  } catch (err) {
    console.error("AI flashcards failed:", err);
    await admin.rpc("refund_ai_quota", { p_user: job.userId, p_feature: FEATURE }); // the try doesn't count
    return {
      ok: false,
      error:
        err instanceof NoCardsError
          ? "Z tego materiału nie dało się zrobić fiszek. Spróbuj z innym plikiem, wyraźniejszym zdjęciem albo wklej tekst."
          : String(err).includes("deck limit")
            ? "Masz już bardzo dużo talii. Usuń kilka starych, żeby zrobić nowe."
            : "AI nie dało rady tym razem. Spróbuj ponownie za chwilę.",
    };
  }
}

/**
 * Fetches a public web page safely: every redirect is checked again, the host's DNS answers must be
 * public addresses (no internal services), and size and time are capped.
 */
async function fetchPage(start: string): Promise<{ title: string; text: string }> {
  const failed = new UserError("Nie udało się otworzyć tej strony. Sprawdź link albo skopiuj tekst i wklej go.");
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    if (!isSafePublicUrl(url)) throw new UserError("Tej strony nie możemy otworzyć. Spróbuj innego linku.");
    await assertPublicDns(new URL(url).hostname);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { "User-Agent": "OgarnijMature/1.0 (+flashcards for students)", Accept: "text/html,text/plain;q=0.9" },
      });
    } catch {
      throw failed;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel();
      if (!next) throw failed;
      url = new URL(next, url).toString();
      continue;
    }
    if (!res.ok || !res.body) throw failed;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type)) {
      await res.body.cancel();
      throw new UserError("To nie jest zwykła strona (może to PDF?). Pobierz plik i wgraj go w zakładce „PDF”.");
    }
    // Read at most PAGE_MAX_BYTES.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > PAGE_MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      bytes.set(c, o);
      o += c.length;
    }
    const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
    let html: string;
    try {
      html = new TextDecoder(charset).decode(bytes);
    } catch {
      html = new TextDecoder().decode(bytes);
    }
    return type.includes("text/plain") ? { title: "", text: html } : htmlToText(html);
  }
  throw failed;
}

/** The domain must not point at private addresses (DNS rebinding to internal services). */
async function assertPublicDns(host: string) {
  if (/^[\d.]+$/.test(host) || host.includes(":")) return; // IP literal, already checked
  for (const type of ["A", "AAAA"] as const) {
    let records: string[] = [];
    try {
      records = await Deno.resolveDns(host, type);
    } catch {
      continue; // no records of this type (or DNS lookups unavailable): fetch will fail if unreachable
    }
    if (records.some(isPrivateAddress)) throw new UserError("Tej strony nie możemy otworzyć. Spróbuj innego linku.");
  }
}

/**
 * The video's captions as plain text, via ScrapeCreators (1 credit per video; repeats of the same
 * video within 30 days come from their cache for free; videos without captions cost nothing).
 */
async function fetchTranscript(url: string): Promise<string> {
  const key = Deno.env.get("SCRAPECREATORS_API_KEY");
  const paste = "Wklej transkrypcję ręcznie: na YouTube „…więcej” → „Pokaż transkrypcję”.";
  if (!key) throw new UserError(`Automatyczne pobieranie transkrypcji jest chwilowo niedostępne. ${paste}`);
  let res: Response;
  try {
    const api = new URL("https://api.scrapecreators.com/v1/youtube/video/transcript");
    api.searchParams.set("url", url);
    api.searchParams.set("cache_max_age", "30d");
    res = await fetch(api, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(TRANSCRIPT_TIMEOUT_MS) });
  } catch {
    throw new UserError(`Nie udało się pobrać transkrypcji (YouTube nie odpowiada). Spróbuj za chwilę. ${paste}`);
  }
  if (res.status === 404) throw new UserError("Nie znaleźliśmy tego filmu. Sprawdź link.");
  if (!res.ok) {
    console.error("ScrapeCreators", res.status, (await res.text()).slice(0, 300));
    throw new UserError(`Nie udało się pobrać transkrypcji. ${paste}`);
  }
  const data = await res.json();
  const text = typeof data.transcript_only_text === "string" ? data.transcript_only_text.trim() : "";
  console.log(`transcript: ${text.length} chars, ${data.language ?? "?"}, charged ${data.credits_charged ?? "?"}${data.cached ? " (cache)" : ""}, left ${data.credits_remaining ?? "?"}`);
  if (text.length < FLASHCARD_LIMITS.minTextChars) {
    throw new UserError(`Ten film nie ma napisów, więc nie da się pobrać transkrypcji. Wybierz inny film albo wklej tekst w zakładce „Tekst”.`);
  }
  return text.slice(0, FLASHCARD_LIMITS.textChars);
}

/** Video title via YouTube's public oEmbed endpoint (best effort). */
async function youtubeTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return typeof data.title === "string" ? data.title.slice(0, 200) : "";
  } catch {
    return "";
  }
}

// OpenAI Responses API, streamed, with Structured Outputs (the answer must match our JSON schema).
async function askOpenAI(job: Job, onProgress: (chars: number) => void): Promise<AiCards> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${job.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: job.model,
        instructions: buildCardsInstructions(job.subject, job.style),
        input: buildCardsInput(job),
        text: { format: { type: "json_schema", name: "flashcards", schema: openAiCardsSchema(job.count), strict: true } },
        reasoning: { effort: Deno.env.get("AI_REASONING_EFFORT") ?? "low" },
        max_output_tokens: 12000,
        prompt_cache_key: `flashcards-${job.subject}-${job.style}`,
        store: false,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);

    let text = "";
    let usage = "";
    for await (const event of readSse(res.body)) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
        onProgress(text.length);
      } else if (event.type === "response.completed") {
        const u = event.response?.usage;
        usage = `in ${u?.input_tokens} (cached ${u?.input_tokens_details?.cached_tokens}), out ${u?.output_tokens}`;
      } else if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error") {
        throw new Error(`OpenAI stream ${event.type}: ${JSON.stringify(event).slice(0, 300)}`);
      } else if (event.type === "response.refusal.delta") {
        throw new Error("OpenAI refused");
      }
    }
    if (!text) throw new Error("OpenAI returned no text");
    console.log(`flashcards: ${job.kind}, ${job.images.length} images, ${job.text.length} chars, model ${job.model}, ${usage}`);
    return aiCardsSchema.parse(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}

// Minimal Server-Sent Events reader: yields each `data: {...}` JSON payload.
// deno-lint-ignore no-explicit-any
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data);
    }
  }
}

function fakeCards(count: number): AiCards {
  return {
    title: "[TRYB TESTOWY] Romantyzm",
    cards: Array.from({ length: Math.min(count, 5) }, (_, i) => ({ front: `Pytanie testowe ${i + 1}`, back: `Odpowiedź ${i + 1}` })),
    warnings: [],
  };
}
