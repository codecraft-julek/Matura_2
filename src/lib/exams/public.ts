// Public, SEO-friendly facts about our exams (the /arkusze-maturalne pages and the sitemap).
// Built from content/exams/*.json at build time (scripts/public-exams-plugin.mjs exposes the result as
// `virtual:public-exams`). Answer keys, accepted answers and hints are dropped HERE: only the exam
// structure (task types, points, word limits) reaches the browser, never what earns the points.
// No "@/..." imports: the prerender script runs this file directly with Node.

import { examContentSchema } from "./content.ts";

export type PublicExam = {
  id: string;
  subject: "polish" | "english";
  level: "basic" | "extended";
  year: number;
  session: "main" | "june" | "august" | "sample";
  title: string;
  durationMinutes: number;
  maxPoints: number;
  taskCount: number;
  sources: { sheet: string; sheet2?: string; key?: string; audio?: string };
  groups: {
    no: number;
    section: string;
    kind: "choice" | "open" | "writing";
    label: string;
    points: number;
    items: number;
    words?: [number, number];
  }[];
};

/** One exam content file (already JSON-parsed) → only its public structure. */
export function toPublicExam(raw: unknown): PublicExam {
  const exam = examContentSchema.parse(raw);
  const groups = exam.groups.map((g) =>
    g.kind === "writing"
      ? { no: g.no, section: g.section, kind: g.kind, label: g.label, points: g.points, items: 1, words: g.meta.words }
      : {
          no: g.no,
          section: g.section,
          kind: g.kind,
          label: g.label,
          items: Object.keys(g.items).length,
          points: Object.values(g.items).reduce((s: number, v) => s + (typeof v === "object" ? (v.points ?? 1) : 1), 0),
        },
  );
  return {
    id: exam.id,
    subject: exam.subject,
    level: exam.level,
    year: exam.year,
    session: exam.session,
    title: exam.title,
    durationMinutes: exam.durationMinutes,
    maxPoints: exam.maxPoints,
    taskCount: groups.reduce((s, g) => s + g.items, 0),
    sources: { sheet: exam.sources.sheet, sheet2: exam.sources.sheet2, key: exam.sources.key, audio: exam.sources.audio },
    groups,
  };
}

/** Newest first (polish before english, basic before extended). */
export function sortPublicExams(exams: PublicExam[]): PublicExam[] {
  const order = (e: PublicExam) => (e.subject === "polish" ? 0 : 2) + (e.level === "basic" ? 0 : 1);
  return [...exams].sort((a, b) => b.year - a.year || order(a) - order(b));
}

// Wording for titles: "Matura z angielskiego 2025, poziom podstawowy".
export const SUBJECT_FROM: Record<PublicExam["subject"], string> = { polish: "z polskiego", english: "z angielskiego" };
export const LEVEL_SHORT: Record<PublicExam["level"], string> = { basic: "podstawowy", extended: "rozszerzony" };

export function examHeadline(e: PublicExam): string {
  return `Matura ${SUBJECT_FROM[e.subject]} ${e.year}, poziom ${LEVEL_SHORT[e.level]}`;
}

/** "1 zadanie", "22 zadania", "25 zadań" (Polish plural rules). */
export function tasksLabel(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return "1 zadanie";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} zadania`;
  return `${n} zadań`;
}
