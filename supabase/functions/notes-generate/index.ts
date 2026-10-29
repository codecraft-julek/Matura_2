// Supabase Edge Function: POST /functions/v1/notes-generate   body: { subject, text?, images? }
//
// AI notes from pasted text and/or photos of notes. Flow: check login → validate → check daily limit →
// save the note as "pending" → ask OpenAI (streamed, strict JSON of blocks) → apply our rules
// (normalizeNote) → save. Photos are only passed to the AI, never stored: we keep the text read from them.
// The website asks for Server-Sent Events, so it can show progress; plain JSON is still supported.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY            required for real notes
//   AI_NOTES_MODEL            optional, default below (falls back to OPENAI_MODEL); must accept images
//   AI_NOTES_GLOBAL_DAILY_LIMIT optional, notes for ALL students per day (default 500) → caps your bill
//   AI_REASONING_EFFORT       optional, "low" (default), "medium" or "high"
//   AI_FAKE_MODE              "true" = an example note without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  NOTE_LIMITS,
  NotNotesError,
  aiNoteSchema,
  buildNotesInput,
  buildNotesInstructions,
  normalizeNote,
  noteRequestSchema,
  openAiNoteSchema,
  type AiNote,
  type NoteSubject,
} from "../_shared/notes.ts";

const DEFAULT_MODEL = "gpt-6.1-sol";
const OPENAI_TIMEOUT_MS = 130_000; // Supabase stops functions at 150 s
const FEATURE = "notes";

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
    console.error("notes-generate crashed:", err);
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie za chwilę." }, 500);
  }
});

async function handle(request: Request) {
  // 1. Who is asking?
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  // 2. Validate (photos make the body big, so the cap is generous)
  const raw = await request.text();
  if (raw.length > NOTE_LIMITS.images * NOTE_LIMITS.imageChars + NOTE_LIMITS.textChars * 2 + 2000) {
    return json({ ok: false, error: "Za duże zdjęcia. Spróbuj z mniejszą liczbą zdjęć." }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400);
  }
  const parsed = noteRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooLittle = parsed.error.issues.some((i) => i.message === "too_little");
    return json(
      { ok: false, error: tooLittle ? "Wklej trochę więcej tekstu albo dodaj zdjęcie notatek." : "Nieprawidłowe dane. Sprawdź zdjęcia i tekst." },
      400,
    );
  }
  const { subject, text, images, file } = parsed.data;

  // 3. Is AI available?
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Notatki AI jeszcze nie są skonfigurowane. Spróbuj trochę później." }, 503);
  }

  // 4. Daily limits
  const globalLimit = Number(Deno.env.get("AI_NOTES_GLOBAL_DAILY_LIMIT") ?? 500);
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

  // 5. Save the note first ("pending"), so the student can see it's being made
  const model = fake ? "fake" : (Deno.env.get("AI_NOTES_MODEL") ?? Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL);
  const { data: note, error: insertError } = await admin
    .from("notes")
    .insert({
      user_id: user.id,
      subject,
      source_kind: file ? file.kind : images.length && text ? "mixed" : images.length ? "photo" : "text",
      source_text: text,
      model,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const job: Job = { noteId: note.id as string, userId: user.id, subject, text, images, file, fake, apiKey, model };

  // 6a. Streaming (what the website uses): progress as Server-Sent Events.
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // If the student closes the page, sending fails, but the note is still made and saved.
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
        send({ type: "start", id: job.noteId });
        let last = 0;
        const result = await runJob(job, (chars) => {
          // Progress only (not the JSON itself): a few events per second is plenty.
          if (chars - last >= 400) {
            last = chars;
            send({ type: "progress", chars });
          }
        });
        clearInterval(ping);
        send(result.ok ? { type: "done", id: job.noteId } : { type: "error", error: result.error });
        if (open) controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 6b. Plain JSON (tests and simple clients)
  const result = await runJob(job, () => {});
  return result.ok ? json({ ok: true, id: job.noteId }) : json({ ok: false, error: result.error }, 502);
}

type StreamEvent =
  | { type: "start"; id: string }
  | { type: "progress"; chars: number }
  | { type: "done"; id: string }
  | { type: "error"; error: string };

type Job = {
  noteId: string;
  userId: string;
  subject: NoteSubject;
  text: string;
  images: string[];
  file?: { kind: "pdf" | "docx" | "pptx"; name: string };
  fake: boolean;
  apiKey: string | undefined;
  model: string;
};

type Usage = { input_tokens: number; cached_tokens: number; output_tokens: number; reasoning_tokens: number; images: number } | null;

/** Asks the AI, applies our rules and saves the note. Never throws. */
async function runJob(job: Job, onProgress: (chars: number) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  const startedAt = Date.now();
  try {
    const { ai, usage } = job.fake ? await fakeNote(onProgress) : await askOpenAI(job, onProgress);
    const note = normalizeNote(ai);
    const sourceText = [job.text, ai.transcript.trim()].filter(Boolean).join("\n\n— odczytane ze zdjęć —\n\n");
    await admin
      .from("notes")
      .update({
        status: "done",
        title: note.title,
        note,
        source_text: sourceText.slice(0, 30000),
        usage,
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.noteId);
    return { ok: true };
  } catch (err) {
    console.error("AI notes failed:", err);
    const notNotes = err instanceof NotNotesError;
    // Nothing useful to keep: remove the pending note, and the try doesn't count.
    await admin.from("notes").delete().eq("id", job.noteId);
    await admin.rpc("refund_ai_quota", { p_user: job.userId, p_feature: FEATURE });
    return {
      ok: false,
      error: notNotes
        ? "Nie udało się rozpoznać notatek. Zrób wyraźniejsze zdjęcie (dobre światło, cała kartka) albo wklej tekst."
        : "AI nie dało rady tym razem. Spróbuj ponownie za chwilę.",
    };
  }
}

// OpenAI Responses API, streamed, with Structured Outputs (the answer must match our JSON schema).
async function askOpenAI(job: Job, onProgress: (chars: number) => void): Promise<{ ai: AiNote; usage: Usage }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${job.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: job.model,
        instructions: buildNotesInstructions(job.subject),
        input: buildNotesInput({ text: job.text, images: job.images, file: job.file }),
        text: { format: { type: "json_schema", name: "study_note", schema: openAiNoteSchema(), strict: true } },
        reasoning: { effort: Deno.env.get("AI_REASONING_EFFORT") ?? "low" },
        max_output_tokens: 16000, // safety cap (includes reasoning tokens)
        prompt_cache_key: `notes-${job.subject}`,
        store: false, // don't keep the student's notes/photos on OpenAI's side
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);

    let text = "";
    let usage: Usage = null;
    for await (const event of readSse(res.body)) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
        onProgress(text.length);
      } else if (event.type === "response.completed") {
        const u = event.response?.usage;
        if (u) {
          usage = {
            input_tokens: u.input_tokens ?? 0,
            cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
            output_tokens: u.output_tokens ?? 0,
            reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
            images: job.images.length,
          };
        }
      } else if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error") {
        throw new Error(`OpenAI stream ${event.type}: ${JSON.stringify(event).slice(0, 300)}`);
      } else if (event.type === "response.refusal.delta") {
        throw new Error("OpenAI refused");
      }
    }
    if (!text) throw new Error("OpenAI returned no text");
    return { ai: aiNoteSchema.parse(JSON.parse(text)), usage };
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

// An example note for testing the whole flow without an OpenAI key (AI_FAKE_MODE=true).
async function fakeNote(onProgress: (chars: number) => void): Promise<{ ai: AiNote; usage: Usage }> {
  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 300));
    onProgress(i * 800);
  }
  return {
    usage: null,
    ai: {
      title: "[TRYB TESTOWY] Romantyzm",
      transcript: "",
      summary: ["Epoka uczuć, wyobraźni i walki o wolność.", "W Polsce: 1822–1863."],
      blocks: [
        {
          type: "timeline",
          heading: "Romantyzm w Polsce",
          events: [
            { date: "1822", label: "„Ballady i romanse” Mickiewicza" },
            { date: "1830", label: "Powstanie listopadowe" },
            { date: "1863", label: "Powstanie styczniowe" },
          ],
          from_notes: true,
        },
        {
          type: "compare",
          heading: "Klasycyzm a romantyzm",
          columns: ["Klasycyzm", "Romantyzm"],
          rows: [{ feature: "Źródło poznania", values: ["rozum", "uczucie, intuicja"] }],
          from_notes: true,
        },
        { type: "remember", items: ["Mesjanizm: Polska jako Chrystus narodów"], from_notes: false },
      ],
      flashcards: [{ front: "Mesjanizm", back: "Przekonanie o szczególnej misji narodu" }],
      quiz: [{ question: "Kiedy zaczął się romantyzm w Polsce?", options: ["1795", "1822", "1830", "1863"], correct: 1, explanation: "„Ballady i romanse”." }],
      warnings: [],
    },
  };
}
