// Schema for exam content files in content/exams/*.json, plus helpers to turn them into
// database rows. Used by scripts/sync-exams.ts and by unit tests.
// Keep this file free of "@/..." imports: the sync script runs it directly with Node.

import { z } from "zod";

// Where to find the task in the official PDF, plus our own short instructions (never CKE's text).
const locator = {
  page: z.number().int().positive().optional(), // PDF page where the task starts
  sheet: z.union([z.literal(1), z.literal(2)]).optional(), // 2 = second PDF (Polish: Arkusz 2, wypracowanie)
  hint: z.string().max(300).optional(),
};

// "1.1" in English exams, "1" or "7.1" in Polish ones.
const taskNumber = z.string().regex(/^\d+(\.\d+)?$/);

const multiItem = z.object({
  answer: z.string().regex(/^[A-HTPF1-9]{2,8}$/), // one character per row
  rows: z.array(z.string().max(12)).optional(), // row labels as printed in the sheet, e.g. ["A", "B"]
  points: z.number().int().positive().optional(),
});

const choiceGroup = z.object({
  ...locator,
  no: z.number().int().positive(),
  section: z.enum(["listening", "reading", "language", "test"]),
  kind: z.literal("choice"),
  label: z.string().min(3),
  // Letters A–H, "TF" (English True/False), "PF" (Polish Prawda/Fałsz) or digits for matching tables.
  options: z.string().regex(/^([A-H]{2,8}|TF|PF|[1-9]{2,9})$/),
  // Simple: "1.1": "B". Multi-part (several rows, one answer each, scored together):
  // "4": { "answer": "PF", "rows": ["1.", "2."], "points": 1 }
  items: z.record(taskNumber, z.union([z.string().regex(/^[A-HTPF1-9]$/), multiItem])),
});

const openItem = z.object({
  answer: z.string().min(1), // what earns the points, in OUR words (shown after grading)
  note: z.string().optional(),
  accepted: z.array(z.string().min(1)),
  points: z.number().int().positive().optional(), // default 1; Polish open tasks can be worth 2–4
});

const openGroup = z.object({
  ...locator,
  no: z.number().int().positive(),
  section: z.enum(["listening", "reading", "language", "test"]),
  kind: z.literal("open"),
  label: z.string().min(3),
  items: z.record(taskNumber, openItem),
});

const writingGroup = z.object({
  ...locator,
  no: z.number().int().positive(),
  section: z.literal("writing"),
  kind: z.literal("writing"),
  label: z.string().min(3),
  points: z.number().int().positive(),
  meta: z.object({
    words: z.tuple([z.number().int(), z.number().int()]), // [min, max]; max 0 = no upper limit
    criteria: z.array(z.object({ name: z.string(), points: z.number().int().positive() })),
    // Extra requirements of this sheet, in OUR words (e.g. "works from two literary epochs" in the
    // 2023–2024 extended Polish exams). Shown under the essay and sent to the AI essay feedback.
    rules: z.array(z.string().min(5).max(200)).max(5).optional(),
  }),
});

export const examContentSchema = z
  .object({
    id: z.string().regex(/^\d{4}-[a-z]+-[a-z]+-(pp|pr)$/),
    subject: z.enum(["polish", "english"]),
    level: z.enum(["basic", "extended"]),
    year: z.number().int().min(2023),
    session: z.enum(["main", "june", "august", "sample"]),
    title: z.string().min(5),
    durationMinutes: z.number().int().positive(),
    maxPoints: z.number().int().positive(),
    sources: z.object({
      sheet: z.url(),
      key: z.url().optional(),
      audio: z.url().optional(),
      transcript: z.url().optional(),
      sheet2: z.url().optional(), // second sheet (Polish: Arkusz 2 – wypracowanie)
    }),
    groups: z.array(z.discriminatedUnion("kind", [choiceGroup, openGroup, writingGroup])).min(1),
  })
  .superRefine((exam, ctx) => {
    // Points must add up to the official total: catches a forgotten or duplicated task.
    const total = exam.groups.reduce(
      (sum, g) =>
        sum +
        (g.kind === "writing"
          ? g.points
          : Object.values(g.items).reduce((s: number, v) => s + (typeof v === "object" ? (v.points ?? 1) : 1), 0)),
      0,
    );
    if (total !== exam.maxPoints) {
      ctx.addIssue({ code: "custom", message: `points add up to ${total}, expected ${exam.maxPoints}` });
    }
    // Every choice answer must be one of the offered letters.
    for (const g of exam.groups) {
      if (g.kind !== "choice") continue;
      for (const [num, value] of Object.entries(g.items)) {
        const answer = typeof value === "string" ? value : value.answer;
        for (const letter of answer) {
          if (!g.options.includes(letter)) {
            ctx.addIssue({ code: "custom", message: `${num}: answer ${letter} not in options ${g.options}` });
          }
        }
        if (typeof value === "object" && value.rows && value.rows.length !== answer.length) {
          ctx.addIssue({ code: "custom", message: `${num}: ${value.rows.length} rows but answer has ${answer.length} parts` });
        }
      }
    }
  });

export type ExamContent = z.infer<typeof examContentSchema>;

/** Same rules as public.normalize_answer() in the database. Tested to stay in sync. */
export function normalizeAnswer(text: string): string {
  return text
    .replace(/[’‘`´]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!]+$/, "");
}

/**
 * All answers we auto-accept for an open item: the explicit list plus the expected answer,
 * split on " / " (e.g. "how old / what age"). Pieces with "(…)" or "…" are display-only.
 */
export function acceptedAnswers(item: z.infer<typeof openItem>): string[] {
  const fromAnswer = item.answer.split(" / ").filter((a) => !/[(…]/.test(a));
  return [...new Set([...fromAnswer, ...item.accepted].map(normalizeAnswer))];
}

export type TaskRow = {
  id: string;
  exam_id: string;
  group_no: number;
  number: string;
  section: string;
  kind: "choice" | "open" | "writing";
  options: string[];
  points: number;
  sort: number;
  group_label: string;
  meta: Record<string, unknown>;
};

export type KeyRow = { task_id: string; correct: string | null; accepted: string[]; display: string; note: string | null };

// Sort "1.2" before "1.10" and "10.1" after "9.4".
function sortKey(num: string): number {
  const [a, b = "0"] = num.split(".");
  return Number(a) * 100 + Number(b);
}

function locate(g: { page?: number; sheet?: 1 | 2; hint?: string }) {
  return {
    ...(g.page ? { page: g.page, sheet: g.sheet ?? 1 } : {}),
    ...(g.hint ? { hint: g.hint } : {}),
  };
}

/** Flattens an exam file into exam_tasks and exam_task_keys rows. */
export function toRows(exam: ExamContent): { tasks: TaskRow[]; keys: KeyRow[] } {
  const tasks: TaskRow[] = [];
  const keys: KeyRow[] = [];

  for (const g of exam.groups) {
    if (g.kind === "writing") {
      const number = String(g.no);
      const id = `${exam.id}:${number}`;
      tasks.push({
        id, exam_id: exam.id, group_no: g.no, number, section: g.section, kind: "writing",
        options: [], points: g.points, sort: g.no * 100, group_label: g.label, meta: { ...g.meta, ...locate(g) },
      });
      keys.push({ task_id: id, correct: null, accepted: [], display: "Oceniane według kryteriów CKE", note: null });
      continue;
    }

    for (const [number, value] of Object.entries(g.items)) {
      const id = `${exam.id}:${number}`;
      const multi = g.kind === "choice" && typeof value === "object" ? (value as z.infer<typeof multiItem>) : null;
      const points = typeof value === "object" ? (value.points ?? 1) : 1;
      tasks.push({
        id, exam_id: exam.id, group_no: g.no, number, section: g.section, kind: g.kind,
        options: g.kind === "choice" ? g.options.split("") : [], points, sort: sortKey(number),
        group_label: g.label,
        // Multi-part closed task: the UI shows one row per character of the answer.
        meta: multi ? { ...locate(g), rows: multi.rows ?? multi.answer.split("").map((_: string, i: number) => `${i + 1}.`) } : locate(g),
      });
      if (g.kind === "choice") {
        const answer = typeof value === "string" ? value : (value as z.infer<typeof multiItem>).answer;
        keys.push({ task_id: id, correct: answer, accepted: [], display: multi?.rows ? multi.rows.map((r: string, i: number) => `${r} ${answer[i]}`).join(", ") : answer, note: null });
      } else {
        const item = value as z.infer<typeof openItem>;
        keys.push({ task_id: id, correct: null, accepted: acceptedAnswers(item), display: item.answer, note: item.note ?? null });
      }
    }
  }

  // Duplicate task numbers would silently overwrite each other in the database.
  const seen = new Set<string>();
  for (const t of tasks) {
    if (seen.has(t.number)) throw new Error(`${exam.id}: duplicate task ${t.number}`);
    seen.add(t.number);
  }
  return { tasks: tasks.sort((a, b) => a.sort - b.sort), keys };
}
