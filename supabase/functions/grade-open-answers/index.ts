// Supabase Edge Function: POST /functions/v1/grade-open-answers   body: { attemptId }
//
// AI grading of open answers in a Polish exam attempt (Arkusz 1). Flow: check login → validate →
// load the student's own attempt and our scoring descriptions (exam_task_keys, server-side only) →
// check daily limit → ask OpenAI for 0…max points + one-sentence reason per task → save with
// save_ai_grades. The student can still change every grade on the results page.
// Exam texts are never sent (we don't store them); the prompt tells the AI it doesn't have them.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY              required for real grading
//   OPENAI_MODEL                optional, default below
//   AI_GLOBAL_DAILY_LIMIT       optional, gradings for ALL students per day (default 300) → caps your bill
//   AI_REASONING_EFFORT         optional, "low" (default), "medium" or "high"
//   AI_FAKE_MODE                "true" = example grades without OpenAI (only for testing, never in production)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically.

import { createClient } from "@supabase/supabase-js";
import { quotaMessage, type QuotaResult } from "../_shared/billing.ts";
import {
  GRADABLE_STATUSES,
  aiGradesSchema,
  buildGradingInput,
  buildGradingInstructions,
  gradeRequestSchema,
  normalizeGrades,
  openAiGradesSchema,
  type AiGrades,
  type GradableTask,
} from "../_shared/open-grading.ts";

const DEFAULT_MODEL = "gpt-6.1-sol";
const OPENAI_TIMEOUT_MS = 110_000; // Supabase stops functions at 150 s
const FEATURE = "open_grading";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Reply = { ok: true; graded: number } | { ok: false; error: string };
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

  // 3. The student's own attempt, a Polish exam
  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("id, exam_id, answers, results, exams(subject)")
    .eq("id", parsed.data.attemptId)
    .eq("user_id", user.id) // only your own attempt
    .maybeSingle();
  if (!attempt) return json({ ok: false, error: "Nie znaleziono tego podejścia." }, 404);
  const exam = attempt.exams as unknown as { subject: string };
  if (exam.subject !== "polish") {
    return json({ ok: false, error: "Ocena AI działa na razie tylko dla arkuszy z polskiego." }, 400);
  }

  // 4. Open answers to grade + our scoring descriptions (read here, never taken from the request)
  const { data: rows, error: rowsError } = await admin
    .from("exam_tasks")
    .select("id, number, points, group_label, meta, exam_task_keys(display, note)")
    .eq("exam_id", attempt.exam_id)
    .eq("kind", "open")
    .eq("section", "test")
    .order("sort");
  if (rowsError) throw rowsError;

  const answers = attempt.answers as Record<string, string>;
  const results = attempt.results as Record<string, { status: string }>;
  const tasks: GradableTask[] = [];
  for (const r of rows ?? []) {
    const answer = answers[r.number]?.trim() ?? "";
    const status = results[r.number]?.status;
    const key = (Array.isArray(r.exam_task_keys) ? r.exam_task_keys[0] : r.exam_task_keys) as
      | { display: string; note: string | null }
      | null;
    if (!answer || !key || !(GRADABLE_STATUSES as readonly string[]).includes(status)) continue;
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
    return json({ ok: false, error: "W tym podejściu nie ma odpowiedzi otwartych do oceny." }, 400);
  }

  // 5. Is AI available?
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const fake = !apiKey && Deno.env.get("AI_FAKE_MODE") === "true";
  if (!apiKey && !fake) {
    return json({ ok: false, error: "Ocena AI jeszcze nie jest skonfigurowana. Spróbuj trochę później." }, 503);
  }

  // 6. Daily limits
  const globalLimit = Number(Deno.env.get("AI_GLOBAL_DAILY_LIMIT") ?? 300);
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

  // 7. Ask the AI and save
  try {
    const ai = fake ? fakeGrades(tasks) : await askOpenAI({ apiKey: apiKey!, model: Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL, tasks });
    const grades = normalizeGrades(tasks, ai);
    if (grades.length === 0) throw new Error("AI returned no usable grades");
    const { data: saved, error: saveError } = await admin.rpc("save_ai_grades", {
      p_attempt_id: attempt.id,
      p_user: user.id,
      p_grades: grades,
    });
    if (saveError) throw saveError;
    return json({ ok: true, graded: saved as number });
  } catch (err) {
    console.error("AI grading failed:", err);
    await admin.rpc("refund_ai_quota", { p_user: user.id, p_feature: FEATURE }); // the try doesn't count
    return json({ ok: false, error: "AI nie dało rady tym razem. Spróbuj ponownie za chwilę." }, 502);
  }
}

// OpenAI Responses API with Structured Outputs (the answer must match our JSON schema).
// Not streamed: the answer is short, and the website shows a loader meanwhile.
async function askOpenAI(o: { apiKey: string; model: string; tasks: GradableTask[] }): Promise<AiGrades> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${o.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: o.model,
        instructions: buildGradingInstructions(),
        input: buildGradingInput(o.tasks),
        text: {
          format: { type: "json_schema", name: "open_grades", schema: openAiGradesSchema(o.tasks.map((t) => t.number)), strict: true },
        },
        reasoning: { effort: Deno.env.get("AI_REASONING_EFFORT") ?? "low" },
        max_output_tokens: 8000, // safety cap (includes reasoning tokens)
        prompt_cache_key: "open-grading", // same instructions for everyone → cached, cheaper and faster
        store: false, // don't keep the student's answers on OpenAI's side
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    if (data.status !== "completed") throw new Error(`OpenAI status ${data.status}: ${JSON.stringify(data.incomplete_details)}`);
    // deno-lint-ignore no-explicit-any
    const content = (data.output ?? []).flatMap((item: any) => (item.type === "message" ? item.content : []));
    // deno-lint-ignore no-explicit-any
    if (content.some((c: any) => c.type === "refusal")) throw new Error("OpenAI refused");
    // deno-lint-ignore no-explicit-any
    const text = content.find((c: any) => c.type === "output_text")?.text;
    if (!text) throw new Error("OpenAI returned no text");
    const u = data.usage;
    console.log(
      `open grading: ${o.tasks.length} tasks, model ${o.model}, in ${u?.input_tokens} (cached ${u?.input_tokens_details?.cached_tokens}), out ${u?.output_tokens}`,
    );
    return aiGradesSchema.parse(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
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
