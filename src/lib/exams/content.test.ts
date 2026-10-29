import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acceptedAnswers, examContentSchema, normalizeAnswer, toRows } from "./content";

const dir = join(__dirname, "..", "..", "..", "content", "exams");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("content/exams/*.json", () => {
  it.each(files)("%s is valid and adds up", (file) => {
    const exam = examContentSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    expect(`${exam.id}.json`).toBe(file);
    const { tasks, keys } = toRows(exam);
    expect(tasks.reduce((s, t) => s + t.points, 0)).toBe(exam.maxPoints);
    expect(keys).toHaveLength(tasks.length);
    // English open tasks can be auto-accepted with at least their expected answer. Polish open
    // tasks describe what earns the points, so the student (later: AI) grades them instead.
    for (const k of keys) {
      const task = tasks.find((t) => t.id === k.task_id)!;
      if (task.kind === "open" && exam.subject === "english") expect(k.accepted.length).toBeGreaterThan(0);
      // multi-row tasks ("PF", "14") store one character per row
      if (task.kind === "choice") for (const c of k.correct ?? "") expect(task.options).toContain(c);
    }
    // Polish extended (formula 2023) is one essay: 35 pts, min. 500 words (2023–2024) or 400 (from 2025).
    if (exam.subject === "polish" && exam.level === "extended") {
      expect(tasks.map((t) => t.kind)).toEqual(["writing"]);
      expect(exam.maxPoints).toBe(35);
      expect((tasks[0].meta.words as number[])[0]).toBe(exam.year <= 2024 ? 500 : 400);
    }
  });
});

describe("examContentSchema", () => {
  const base = {
    id: "2025-maj-angielski-pp",
    subject: "english",
    level: "basic",
    year: 2025,
    session: "main",
    title: "Test exam",
    durationMinutes: 120,
    maxPoints: 2,
    sources: { sheet: "https://cke.gov.pl/x.pdf" },
    groups: [{ no: 1, section: "reading", kind: "choice", label: "Wybierz", options: "ABC", items: { "1.1": "A", "1.2": "B" } }],
  };

  it("accepts a consistent exam", () => {
    expect(examContentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects points that don't add up", () => {
    expect(examContentSchema.safeParse({ ...base, maxPoints: 3 }).success).toBe(false);
  });

  it("supports True/False tasks", () => {
    const tf = { ...base, groups: [{ ...base.groups[0], options: "TF", items: { "1.1": "T", "1.2": "F" } }] };
    expect(examContentSchema.safeParse(tf).success).toBe(true);
  });

  it("supports multi-row tasks with partial points", () => {
    const multi = { ...base, maxPoints: 2, groups: [{ ...base.groups[0], options: "PF", items: { "1": { answer: "PPF", points: 2 } } }] };
    expect(examContentSchema.safeParse(multi).success).toBe(true);
    const rows = { ...multi, groups: [{ ...multi.groups[0], items: { "1": { answer: "PPF", rows: ["A", "B"], points: 2 } } }] };
    expect(examContentSchema.safeParse(rows).success).toBe(false); // 3 answers, 2 rows
  });

  it("supports writing tasks with sheet-specific requirements", () => {
    const writing = {
      ...base,
      maxPoints: 35,
      groups: [
        {
          no: 1,
          section: "writing",
          kind: "writing",
          label: "Wypracowanie",
          points: 35,
          meta: { words: [400, 0], criteria: [{ name: "Całość", points: 35 }], rules: ["Utwory z dwóch epok."] },
        },
      ],
    };
    expect(examContentSchema.safeParse(writing).success).toBe(true);
    const { tasks } = toRows(examContentSchema.parse(writing));
    expect(tasks[0].meta.rules).toEqual(["Utwory z dwóch epok."]);
    const tooMany = { ...writing, groups: [{ ...writing.groups[0], meta: { ...writing.groups[0].meta, rules: Array(6).fill("Zasada") } }] };
    expect(examContentSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects an answer letter that isn't offered", () => {
    const bad = { ...base, groups: [{ ...base.groups[0], items: { "1.1": "A", "1.2": "D" } }] };
    expect(examContentSchema.safeParse(bad).success).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("matches the database rules", () => {
    // Same cases are checked against public.normalize_answer() in the integration tests.
    expect(normalizeAnswer("  Three  Weeks. ")).toBe("three weeks");
    expect(normalizeAnswer("haven’t got")).toBe("haven't got");
    expect(normalizeAnswer("Public transport!")).toBe("public transport");
  });
});

describe("acceptedAnswers", () => {
  it("splits multi-answers and skips display-only variants", () => {
    expect(acceptedAnswers({ answer: "how old / what age", accepted: ["How young"] })).toEqual([
      "how old",
      "what age",
      "how young",
    ]);
    expect(acceptedAnswers({ answer: "sell (tennis) balls", accepted: ["sell balls"] })).toEqual(["sell balls"]);
  });
});
