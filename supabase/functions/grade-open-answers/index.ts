// Supabase Edge Function: POST /functions/v1/grade-open-answers   body: { attemptId }
//
// Automatic grading of unanswered-by-key open tasks in a saved Polish/English exam attempt.
// Official CKE sheet, marking guide and (when needed) transcript are supplied as PDF inputs.
// An attempt lease prevents duplicate quota use; saved and manually corrected grades are reused.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY              required for real grading
//   AI_GRADING_MODEL            optional, default below
//   AI_GLOBAL_DAILY_LIMIT       optional, gradings for ALL students per day (default 300) → caps your bill
//   AI_REASONING_EFFORT         optional, "low" (default), "medium" or "high"
//   AI_FAKE_MODE                "true" = example grades without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { askAi } from "../_shared/ai.ts";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  aiGradesSchema,
  buildGradingContent,
  buildGradingInstructions,
  completeGrades,
  gradeRequestSchema,
  officialGradingFiles,
  openAiGradesSchema,
  type AiGrades,
  type GradableTask,
  type GradingExam,
} from "../_shared/open-grading.ts";

// Reads whole PDFs, so the input is large (about 110-150k tokens): the cheap model is what makes
// automatic grading affordable. In our test it matched CKE's rules in 90 of 91 answers.
const GRADING_MODEL = "gpt-6-luna";
const AI_TIMEOUT_MS = 110_000; // Supabase stops functions at 150 s
const FEATURE = "open_grading";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reply = { ok: true; graded: number; pending?: boolean } | { ok: false; error: string };
function json(body: Reply, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    return await handle(request);
  } catch (err) {
    console.error("grade-open-answers crashed:", err);
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
  if (raw.length > 2_000) return json({ ok: false, error: "Nieprawidłowe dane." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane." }, 400);
  }
  const parsed = gradeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "Nieprawidłowe dane." }, 400);

  // 3. The student's own attempt and trusted document URLs
  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, exam_id, answers, results, exams(subject, title, sheet_url, key_url, transcript_url)")
    .eq("id", parsed.data.attemptId)
    .eq("user_id", user.id) // only your own attempt
    .maybeSingle();
  if (!attempt) return json({ ok: false, error: "Nie znaleziono tego podejścia." }, 404);
  const exam = attempt.exams as unknown as GradingExam;
  if (!["polish", "english"].includes(exam.subject)) {
    return json({ ok: false, error: "Ocena AI nie obsługuje jeszcze tego przedmiotu." }, 400);
  }

  // 4. Open answers to grade + our scoring descriptions (read here, never taken from the request)
  const { data: rows, error: rowsError } = await admin
    .from("exam_tasks")
    .select("id, number, points, section, group_label, meta, exam_task_keys(display, note)")
    .eq("exam_id", attempt.exam_id)
    .eq("kind", "open")
    .order("sort");
  if (rowsError) throw rowsError;

  const answers = attempt.answers as Record<string, string>;
  const results = attempt.results as Record<string, { status: string }>;
  const tasks: GradableTask[] = [];
  let needsTranscript = false;
  for (const r of rows ?? []) {
    const answer = answers[r.number]?.trim() ?? "";
    const status = results[r.number]?.status;
    const key = (Array.isArray(r.exam_task_keys) ? r.exam_task_keys[0] : r.exam_task_keys) as
      | { display: string; note: string | null }
      | null;
    if (!answer || status !== "unchecked") continue;
    if (!key) return json({ ok: false, error: "Brakuje zasad oceniania jednego z zadań. Twoje odpowiedzi są zapisane; spróbuj później." }, 503);
    if (r.section === "listening") needsTranscript = true;
    tasks.push({
      number: r.number,
      max: r.points,
      hint: ((r.meta as { hint?: string } | null)?.hint ?? r.group_label) || "",
      scoring: key.display,
      note: key.note,
      answer,
    });
  }
  if (tasks.length === 0) {
    return json({ ok: true, graded: 0 });
  }

  let files: string[];
  try {
    files = officialGradingFiles(exam, needsTranscript);
  } catch {
    return json({ ok: false, error: "Brakuje oficjalnych materiałów CKE do tego arkusza. Odpowiedzi są zapisane; ocena AI jest chwilowo niedostępna." }, 503);
  }

  // 5. Is AI available?
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Ocena AI jeszcze nie jest skonfigurowana. Spróbuj trochę później." }, 503);
  }

  // 6. Claim before consuming quota: another tab may already be grading or have finished.
  const leaseToken = crypto.randomUUID();
  const leaseArgs = { p_attempt_id: attempt.id, p_user: user.id, p_token: leaseToken };
  const { data: claim, error: claimError } = await admin.rpc("claim_open_grading", leaseArgs);
  if (claimError) throw claimError;
  if (claim === "done") return json({ ok: true, graded: 0 });
  if (claim === "busy") return json({ ok: true, graded: 0, pending: true }, 202);
  if (claim !== "claimed") throw new Error("Unexpected grading lease response");
  let consumed = false;
  try {
    const globalLimit = Number(Deno.env.get("AI_GLOBAL_DAILY_LIMIT") ?? 300);
    const { data: quota, error: quotaError } = await admin.rpc("consume_plan_quota", {
      p_user: user.id,
      p_feature: FEATURE,
      p_global_limit: globalLimit,
    });
    if (quotaError) throw quotaError;
    if (!(quota as QuotaResult).allowed) {
      return json({ ok: false, error: quotaMessage(FEATURE, quota as QuotaResult) }, 429);
    }
    consumed = true;

    // 7. Ask the AI and save
    const ai = fake ? fakeGrades(tasks) : await askModel({ tasks, exam, files });
    const grades = completeGrades(tasks, ai);
    const { data: saved, error: saveError } = await admin.rpc("finish_open_grading", {
      ...leaseArgs,
      p_grades: grades,
    });
    if (saveError) throw saveError;
    return json({ ok: true, graded: saved as number });
  } catch (err) {
    console.error("AI grading failed:", err);
    if (consumed) await admin.rpc("refund_ai_quota", { p_user: user.id, p_feature: FEATURE });
    return json({ ok: false, error: "AI nie dało rady tym razem. Spróbuj ponownie za chwilę." }, 502);
  } finally {
    await admin.rpc("release_open_grading", leaseArgs);
  }
}

// OpenAI Responses API with Structured Outputs (the answer must match our JSON schema).
async function askModel(o: { tasks: GradableTask[]; exam: GradingExam; files: string[] }): Promise<AiGrades> {
  const { text } = await askAi({
    // OpenAI even when another provider is the default: Claude refuses these PDFs (cke.gov.pl's robots.txt).
    provider: "openai",
    model: Deno.env.get("AI_GRADING_MODEL") ?? GRADING_MODEL,
    instructions: buildGradingInstructions(o.exam.subject),
    input: [{ role: "user", content: buildGradingContent(o.exam, o.tasks, o.files) }],
    schema: { name: "open_grades", schema: openAiGradesSchema(o.tasks.map((t) => t.number)) },
    maxTokens: 8000,
    cacheKey: `open-grading-cke-${o.exam.subject}`,
    timeoutMs: AI_TIMEOUT_MS,
  });
  return aiGradesSchema.parse(JSON.parse(text));
}

// Example grades for testing the whole flow without an OpenAI key (AI_FAKE_MODE=true).
function fakeGrades(tasks: GradableTask[]): AiGrades {
  return {
    grades: tasks.map((t, i) => ({
      number: t.number,
      points: i % 2 ? 0 : t.max,
      reason: "[TRYB TESTOWY] Przykładowe uzasadnienie bez prawdziwego AI.",
      uncertain: i % 3 === 2,
    })),
  };
}
