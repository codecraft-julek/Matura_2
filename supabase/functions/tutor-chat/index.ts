// Supabase Edge Function: POST /functions/v1/tutor-chat
//   body: { chatId?, examId?, groupNo?, message, answers? }   (see _shared/tutor.ts)
//
// AI tutor chat. Flow: check login → validate → load the chat (or the task for a new chat) →
// check daily limit → save the student's message → ask OpenAI (streamed as Server-Sent Events) →
// save the reply. If the AI fails, the student's message is removed and the try doesn't count.
// The answer key is read here (service role), never sent by the browser.
// When the student asks for flashcards, the reply can carry a validated deck proposal. This function
// never creates a deck: that happens in flashcards-generate, after the student clicks.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY or OPENAI_API_KEY   required for real answers; see _shared/ai.ts
//   AI_TUTOR_MODEL             optional, overrides the default model
//   AI_TUTOR_GLOBAL_DAILY_LIMIT optional, messages for ALL students per day (default 3000) → caps your bill
//   AI_REASONING_EFFORT        optional, "low" (default), "medium" or "high"
//   AI_FAKE_MODE               "true" = example answers without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { aiKey, aiModel, askAi } from "../_shared/ai.ts";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  TUTOR_LIMITS,
  buildTaskContext,
  buildTutorInput,
  buildTutorInstructions,
  chatTitle,
  deckMarkerFilter,
  splitDeckProposal,
  tutorRequestSchema,
  wantsFlashcards,
  type DeckProposal,
  type ChatMessage,
  type TutorTaskContext,
} from "../_shared/tutor.ts";

const AI_TIMEOUT_MS = 90_000;
const FEATURE = "tutor";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reply = { ok: true; chatId: string; messageId: number; reply: string; deckProposal: DeckProposal | null } | { ok: false; error: string };
function json(body: Reply, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("tutor-chat crashed:", err);
    return json({ ok: false, error: "Coś poszło nie tak. Spróbuj ponownie za chwilę." }, 500);
  }
});

async function handle(request: Request) {
  // 1. Who is asking?
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Zaloguj się ponownie." }, 401);

  // 2. Validate
  const raw = await request.text();
  if (raw.length > 60_000) return json({ ok: false, error: "Wiadomość jest za długa." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400);
  }
  const parsed = tutorRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === "message" && i.code === "too_big");
    return json({ ok: false, error: tooLong ? `Wiadomość może mieć maks. ${TUTOR_LIMITS.messageChars} znaków.` : "Nieprawidłowe dane." }, 400);
  }
  const req = parsed.data;

  // 3. Existing chat (own only) or the task for a new one
  let chatId = req.chatId ?? null;
  let examId = req.examId ?? null;
  let groupNo = req.groupNo ?? null;
  let history: ChatMessage[] = [];
  if (chatId) {
    const { data: chat } = await admin
      .from("tutor_chats")
      .select("id, exam_id, group_no")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!chat) return json({ ok: false, error: "Nie znaleziono tej rozmowy." }, 404);
    examId = chat.exam_id;
    groupNo = chat.group_no;

    const { data: rows, error } = await admin
      .from("tutor_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("id", { ascending: true });
    if (error) throw error;
    history = (rows ?? []) as ChatMessage[];
    if (history.filter((m) => m.role === "user").length >= TUTOR_LIMITS.userMessagesPerChat) {
      return json({ ok: false, error: "Ta rozmowa jest już bardzo długa. Zacznij nową, żeby tutor lepiej się skupił." }, 400);
    }
  }
  const ctx = examId && groupNo ? await loadTaskContext(examId, groupNo) : null;
  if (!chatId && examId && !ctx) return json({ ok: false, error: "Nie znaleziono tego zadania." }, 404);

  // 4. Is AI available?
  const apiKey = aiKey();
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Tutor jeszcze nie jest skonfigurowany. Spróbuj trochę później." }, 503);
  }

  // 5. Daily limits
  const globalLimit = Number(Deno.env.get("AI_TUTOR_GLOBAL_DAILY_LIMIT") ?? 3000);
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

  // 6. Save the chat (if new) and the student's message
  const isNewChat = !chatId;
  if (isNewChat) {
    const { data: chat, error } = await admin
      .from("tutor_chats")
      .insert({ user_id: user.id, exam_id: examId, group_no: groupNo, title: chatTitle(req.message, ctx) })
      .select("id")
      .single();
    if (error) throw error;
    chatId = chat.id as string;
  }
  const { data: userMsg, error: msgError } = await admin
    .from("tutor_messages")
    .insert({ chat_id: chatId, user_id: user.id, role: "user", content: req.message })
    .select("id")
    .single();
  if (msgError) throw msgError;
  history.push({ role: "user", content: req.message });

  const job: Job = {
    chatId: chatId!,
    userId: user.id,
    userMessageId: userMsg.id as number,
    isNewChat,
    wantsDeck: wantsFlashcards(req.message),
    fake,
    model: Deno.env.get("AI_TUTOR_MODEL") ?? aiModel(),
    input: buildTutorInput(history, ctx ? buildTaskContext(ctx, req.answers) : null),
  };

  // 7a. Streaming (what the website uses)
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // If the student closes the page (or the phone locks), sending fails, but the job keeps
        // running and the result is saved; the page shows it when opened again.
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
        send({ type: "start", chatId: job.chatId });
        const result = await runJob(job, (text) => send({ type: "delta", text }));
        clearInterval(ping);
        send(result.ok
          ? { type: "done", chatId: job.chatId, messageId: result.messageId, reply: result.reply, deckProposal: result.deckProposal }
          : { type: "error", error: result.error });
        if (open) controller.close();
      },
    });
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // 7b. Plain JSON (tests and simple clients)
  const result = await runJob(job, () => {});
  return result.ok
    ? json({ ok: true, chatId: job.chatId, messageId: result.messageId, reply: result.reply, deckProposal: result.deckProposal })
    : json({ ok: false, error: result.error }, 502);
}

type StreamEvent =
  | { type: "start"; chatId: string }
  | { type: "delta"; text: string }
  // messageId: the saved reply (for 👍/👎 and the deck button). reply: its final text, without the marker.
  | { type: "done"; chatId: string; messageId: number; reply: string; deckProposal: DeckProposal | null }
  | { type: "error"; error: string };

type Job = {
  chatId: string;
  userId: string;
  userMessageId: number;
  isNewChat: boolean;
  wantsDeck: boolean;
  fake: boolean;
  model: string;
  input: ReturnType<typeof buildTutorInput>;
};

type Usage = { model: string; input_tokens: number; cached_tokens: number; output_tokens: number } | null;

/** Asks the AI and saves the reply. On failure undoes the student's message. Never throws. */
async function runJob(
  job: Job,
  onDelta: (text: string) => void,
): Promise<{ ok: true; reply: string; messageId: number; deckProposal: DeckProposal | null } | { ok: false; error: string }> {
  try {
    const { reply: raw, usage } = job.fake ? await fakeStream(onDelta) : await askModel(job, deckMarkerFilter(onDelta));
    const { text, proposal } = splitDeckProposal(raw);
    const reply = text.slice(0, 12000);
    const deckProposal = job.wantsDeck ? proposal : null;
    const { data: saved, error } = await admin
      .from("tutor_messages")
      .insert({ chat_id: job.chatId, user_id: job.userId, role: "assistant", content: reply, usage, deck_proposal: deckProposal })
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("tutor_chats").update({ updated_at: new Date().toISOString() }).eq("id", job.chatId);
    return { ok: true, reply, messageId: saved.id as number, deckProposal };
  } catch (err) {
    console.error("Tutor reply failed:", err);
    // Undo, so a retry starts clean: the message (and an empty new chat) go away, the try doesn't count.
    await admin.from("tutor_messages").delete().eq("id", job.userMessageId);
    if (job.isNewChat) await admin.from("tutor_chats").delete().eq("id", job.chatId);
    await admin.rpc("refund_ai_quota", { p_user: job.userId, p_feature: FEATURE });
    return { ok: false, error: "Tutor nie dał rady tym razem. Spróbuj wysłać jeszcze raz." };
  }
}

/** The task group as the tutor sees it: our structure + key, read with the service role. */
async function loadTaskContext(examId: string, groupNo: number): Promise<TutorTaskContext | null> {
  const { data: exam } = await admin.from("exams").select("title, subject, published").eq("id", examId).maybeSingle();
  if (!exam?.published) return null;
  const { data: rows, error } = await admin
    .from("exam_tasks")
    .select("number, kind, points, options, group_label, meta, exam_task_keys(display, note)")
    .eq("exam_id", examId)
    .eq("group_no", groupNo)
    .order("sort");
  if (error) throw error;
  if (!rows?.length) return null;

  type Meta = { hint?: string; page?: number; sheet?: 1 | 2; words?: [number, number]; criteria?: { name: string; points: number }[] };
  const meta = (rows[0].meta ?? {}) as Meta;
  return {
    examTitle: exam.title,
    subject: exam.subject,
    groupNo,
    label: rows[0].group_label,
    hint: meta.hint ?? null,
    page: meta.page ?? null,
    sheet: meta.sheet === 2 ? 2 : 1,
    criteria: meta.criteria,
    words: meta.words,
    tasks: rows.map((r) => {
      const key = (Array.isArray(r.exam_task_keys) ? r.exam_task_keys[0] : r.exam_task_keys) as
        | { display: string; note: string | null }
        | null;
      return {
        number: r.number,
        kind: r.kind as "choice" | "open" | "writing",
        points: r.points,
        options: r.options?.length ? r.options : null,
        key: key?.display ?? "brak",
        note: key?.note ?? null,
      };
    }),
  };
}

// Streamed as plain text (a chat reply, no JSON schema needed).
async function askModel(job: Job, onDelta: (text: string) => void): Promise<{ reply: string; usage: Usage }> {
  const { text, usage, model } = await askAi({
    model: job.model,
    instructions: buildTutorInstructions(),
    input: job.input,
    maxTokens: 6000,
    cacheKey: "tutor", // same instructions for everyone → cached, cheaper and faster
    timeoutMs: AI_TIMEOUT_MS,
    onDelta,
    allowIncomplete: true, // a reply cut off at the limit is still useful
  });
  return {
    reply: text.trim(),
    usage: usage && { model, input_tokens: usage.input_tokens, cached_tokens: usage.cached_tokens, output_tokens: usage.output_tokens },
  };
}

// Example answer for testing the whole flow without an OpenAI key (AI_FAKE_MODE=true).
async function fakeStream(onDelta: (text: string) => void): Promise<{ reply: string; usage: Usage }> {
  const reply =
    "[TRYB TESTOWY] Dobre pytanie! Zanim podam odpowiedź: **co już wiesz** o tym zadaniu?\n\n- Przeczytaj polecenie jeszcze raz\n- Podkreśl słowa-klucze\n\nNapisz, co Ci wyszło.";
  for (const piece of reply.match(/.{1,12}/gs) ?? []) {
    onDelta(piece);
    await new Promise((r) => setTimeout(r, 40));
  }
  return { reply, usage: null };
}
