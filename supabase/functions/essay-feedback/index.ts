// Supabase Edge Function: POST /functions/v1/essay-feedback
//
// AI feedback for a Polish essay ("wypracowanie") or an English writing task from an exam attempt.
// Flow: check login → validate → check daily limit → save essay as "pending" → ask OpenAI (streamed) →
// validate + apply CKE rules → save feedback. The website asks for Server-Sent Events, so the student
// sees the summary and criteria appear live; plain JSON is still supported.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY        required for real feedback (you add it)
//   OPENAI_MODEL          optional, default below
//   AI_GLOBAL_DAILY_LIMIT optional, checks for ALL students per day (default 300) → caps your bill
//   AI_REASONING_EFFORT   optional, "low" (default, fastest for gpt-6.1-sol), "medium" or "high"
//   AI_FAKE_MODE          "true" = example feedback without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  MIN_WORDS_FOR_FEEDBACK,
  RUBRICS,
  aiFeedbackSchema,
  applyCkeRules,
  buildInput,
  buildInstructions,
  countWords,
  essayRequestSchema,
  openAiSchema,
  rubricFor,
  type AiFeedback,
  type RubricId,
} from "../_shared/essay.ts";

const DEFAULT_MODEL = "gpt-6.1-sol";
const OPENAI_TIMEOUT_MS = 110_000; // Supabase stops functions at 150 s

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
    console.error("essay-feedback crashed:", err);
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie za chwilę." }, 500);
  }
});

async function handle(request: Request) {
  // 1. Who is asking? (the website sends the student's login token)
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  // 2. Validate the request
  const raw = await request.text();
  if (raw.length > 60_000) return json({ ok: false, error: "Tekst jest za długi." }, 413);
  const parsed = essayRequestSchema.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." }, 400);
  const req = parsed.data;

  // 3. Collect the text to grade
  let kind: "polish_essay" | "english_writing";
  let level: "basic" | "extended";
  let topic: string;
  let content: string;
  let attemptId: string | null = null;
  let taskNumber: string | null = null;
  // From the exam task: its own word minimum and extra requirements (e.g. the 2023–2024 extended
  // Polish sheets: min. 500 words, works from two literary epochs). Free essays use the rubric's.
  let minWords: number | undefined;
  let rules: string[] = [];

  if (req.mode === "polish") {
    kind = "polish_essay";
    level = req.level;
    topic = req.topic;
    content = req.content;
  } else {
    const { data: attempt } = await admin
      .from("exam_attempts")
      .select("id, user_id, exam_id, answers, exams(level, subject)")
      .eq("id", req.attemptId)
      .eq("user_id", user.id) // only your own attempt
      .maybeSingle();
    if (!attempt) return json({ ok: false, error: "Nie znaleziono tego podejścia." }, 404);
    const exam = attempt.exams as unknown as { level: "basic" | "extended"; subject: string };
    const text = (attempt.answers as Record<string, string>)[req.taskNumber]?.trim() ?? "";
    if (!text) return json({ ok: false, error: "W tym podejściu nie ma wypowiedzi pisemnej." }, 400);

    // English writing task, or the Polish essay (Arkusz 2 in basic, the whole sheet in extended).
    kind = exam.subject === "polish" ? "polish_essay" : "english_writing";
    level = exam.level;
    const { data: task } = await admin
      .from("exam_tasks")
      .select("meta")
      .eq("exam_id", attempt.exam_id)
      .eq("number", req.taskNumber)
      .eq("kind", "writing")
      .maybeSingle();
    if (!task) return json({ ok: false, error: "W tym arkuszu nie ma takiej wypowiedzi pisemnej." }, 400);
    const meta = (task.meta ?? {}) as { words?: [number, number]; rules?: string[] };
    minWords = meta.words?.[0] || undefined;
    rules = meta.rules ?? [];
    topic = req.prompt;
    content = text;
    attemptId = attempt.id;
    taskNumber = req.taskNumber;
  }

  const words = countWords(content);
  if (words < MIN_WORDS_FOR_FEEDBACK) {
    return json({ ok: false, error: `Tekst jest za krótki (${words} wyrazów). Napisz co najmniej ${MIN_WORDS_FOR_FEEDBACK}.` }, 400);
  }

  // 4. Is AI available?
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Feedback AI jeszcze nie jest skonfigurowany. Spróbuj trochę później." }, 503);
  }

  // 5. Daily limits
  const globalLimit = Number(Deno.env.get("AI_GLOBAL_DAILY_LIMIT") ?? 300);
  // The student's limit depends on their plan (table plan_limits); the global cap protects the bill.
  const { data: quota, error: quotaError } = await admin.rpc("consume_plan_quota", {
    p_user: user.id,
    p_feature: "essay_feedback",
    p_global_limit: globalLimit,
  });
  if (quotaError) throw quotaError;
  if (!(quota as QuotaResult).allowed) {
    return json({ ok: false, error: quotaMessage("essay_feedback", quota as QuotaResult) }, 429);
  }

  // 6. Save the essay first, so nothing is lost if the AI call fails
  const model = fake ? "fake" : (Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL);
  const { data: essay, error: insertError } = await admin
    .from("essays")
    .insert({ user_id: user.id, kind, level, attempt_id: attemptId, task_number: taskNumber, topic, content, word_count: words, model })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const rubric: RubricId = rubricFor(kind, level);
  const job = { essayId: essay.id as string, userId: user.id, rubric, fake, apiKey, model, topic, content, words, minWords, rules };

  // 7a. Streaming (what the website uses): send progress as Server-Sent Events.
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        // While the model is "thinking" nothing arrives; a ping every 5 s keeps the connection alive.
        const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 5000);
        send({ type: "start", id: job.essayId, words });
        const result = await runJob(job, (text) => send({ type: "delta", text }));
        clearInterval(ping);
        send(result.ok ? { type: "done", id: job.essayId } : { type: "error", error: result.error });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 7b. Plain JSON (used by tests and simple clients).
  const result = await runJob(job, () => {});
  return result.ok ? json({ ok: true, id: job.essayId }) : json({ ok: false, error: result.error }, 502);
}

type StreamEvent =
  | { type: "start"; id: string; words: number }
  | { type: "delta"; text: string }
  | { type: "done"; id: string }
  | { type: "error"; error: string };

type Job = {
  essayId: string;
  userId: string;
  rubric: RubricId;
  fake: boolean;
  apiKey: string | undefined;
  model: string;
  topic: string;
  content: string;
  words: number;
  minWords: number | undefined;
  rules: string[];
};

/** Asks the AI, applies the CKE rules and saves the result. Never throws. */
async function runJob(job: Job, onDelta: (text: string) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  const startedAt = Date.now();
  try {
    const { ai, usage } = job.fake
      ? await fakeStream(job.rubric, job.content, onDelta)
      : await askOpenAI({ ...job, apiKey: job.apiKey! }, onDelta);
    const feedback = applyCkeRules(job.rubric, ai, {
      content: job.content,
      words: job.words,
      hasPrompt: job.topic.trim().length > 0,
      minWords: job.minWords,
    });
    await admin
      .from("essays")
      .update({ status: "done", feedback, usage, duration_ms: Date.now() - startedAt, completed_at: new Date().toISOString() })
      .eq("id", job.essayId);
    return { ok: true };
  } catch (err) {
    console.error("AI feedback failed:", err);
    await admin
      .from("essays")
      .update({ status: "error", error: String(err).slice(0, 500), duration_ms: Date.now() - startedAt })
      .eq("id", job.essayId);
    await admin.rpc("refund_ai_quota", { p_user: job.userId, p_feature: "essay_feedback" }); // the try doesn't count
    return { ok: false, error: "AI nie dało rady tym razem. Twój tekst jest zapisany, spróbuj ponownie za chwilę." };
  }
}

type Usage = { input_tokens: number; cached_tokens: number; output_tokens: number; reasoning_tokens: number } | null;

// OpenAI Responses API, streamed, with Structured Outputs (the answer must match our JSON schema).
// Speed: reasoning effort "low" by default (gpt-6.1-sol supports low/medium/high; default would be medium),
// short answers enforced in the prompt. Change with the AI_REASONING_EFFORT secret.
async function askOpenAI(
  o: { apiKey: string; model: string; rubric: RubricId; topic: string; content: string; words: number; minWords?: number; rules: string[] },
  onDelta: (text: string) => void,
): Promise<{ ai: AiFeedback; usage: Usage }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: o.model,
        instructions: buildInstructions(o.rubric),
        input: buildInput({ topic: o.topic, content: o.content, words: o.words, rubric: o.rubric, minWords: o.minWords, rules: o.rules }),
        text: { format: { type: "json_schema", name: "essay_feedback", schema: openAiSchema(o.rubric), strict: true } },
        reasoning: { effort: Deno.env.get("AI_REASONING_EFFORT") ?? "low" },
        max_output_tokens: 16000, // safety cap (includes reasoning tokens)
        prompt_cache_key: `essay-${o.rubric}`, // same instructions for everyone → cached, cheaper and faster
        store: false, // don't keep the student's text on OpenAI's side for later retrieval
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);

    let text = "";
    let usage: Usage = null;
    for await (const event of readSse(res.body)) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
        onDelta(event.delta);
      } else if (event.type === "response.completed") {
        const u = event.response?.usage;
        if (u) {
          usage = {
            input_tokens: u.input_tokens ?? 0,
            cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
            output_tokens: u.output_tokens ?? 0,
            reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
          };
        }
      } else if (event.type === "response.failed" || event.type === "response.incomplete" || event.type === "error") {
        throw new Error(`OpenAI stream ${event.type}: ${JSON.stringify(event).slice(0, 300)}`);
      } else if (event.type === "response.refusal.delta") {
        throw new Error("OpenAI refused");
      }
    }
    if (!text) throw new Error("OpenAI returned no text");
    return { ai: aiFeedbackSchema.parse(JSON.parse(text)), usage };
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

// Example feedback for testing the whole flow without an OpenAI key (AI_FAKE_MODE=true).
// It "streams" like the real thing: a short pause, then the JSON in small pieces.
async function fakeStream(rubric: RubricId, content: string, onDelta: (text: string) => void): Promise<{ ai: AiFeedback; usage: Usage }> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const ai = fakeFeedback(rubric, content);
  const text = JSON.stringify(ai);
  await sleep(4000); // like the model "thinking"
  for (let i = 0; i < text.length; i += 24) {
    onDelta(text.slice(i, i + 24));
    await sleep(60);
  }
  return { ai, usage: null };
}

function fakeFeedback(rubric: RubricId, content: string): AiFeedback {
  const firstSentence = content.split(/(?<=[.!?])\s/)[0]?.slice(0, 120) ?? content.slice(0, 60);
  const words = content.split(/\s+/);
  const issue = words.slice(Math.min(10, words.length - 4), Math.min(14, words.length)).join(" ");
  return {
    summary: "[TRYB TESTOWY] To przykładowy feedback bez prawdziwego AI. Po dodaniu klucza OpenAI pojawi się tu prawdziwa ocena.",
    criteria: RUBRICS[rubric].criteria.map((c, i) => ({
      id: c.id,
      points: Math.max(0, c.max - (i % 2)),
      verdict: i % 2 ? "fix" : "good",
      comment: i % 2 ? "Przykładowa uwaga do poprawy." : "Przykładowa mocna strona.",
    })),
    highlights: [
      { quote: firstSentence, type: "good", comment: "Przykład: dobrze sformułowana myśl." },
      ...(issue ? [{ quote: issue, type: "issue" as const, comment: "Przykład: ten fragment warto poprawić." }] : []),
    ],
    top_tip: "Przykładowa wskazówka: rozwiń drugi argument.",
  };
}
