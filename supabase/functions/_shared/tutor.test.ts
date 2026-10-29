import { describe, expect, it } from "vitest";
import {
  TUTOR_LIMITS,
  buildTaskContext,
  buildTutorInput,
  buildTutorInstructions,
  chatTitle,
  tutorRequestSchema,
  type TutorTaskContext,
} from "./tutor";

const ctx: TutorTaskContext = {
  examTitle: "Język polski, poziom podstawowy, maj 2026",
  subject: "polish",
  groupNo: 1,
  label: "Prawda czy fałsz",
  hint: "Oceń każde stwierdzenie.",
  page: 6,
  sheet: 1,
  tasks: [{ number: "1", kind: "choice", points: 2, options: ["P", "F"], key: "1. P, 2. P, 3. P", note: null }],
};

describe("tutorRequestSchema", () => {
  it("accepts a general question and a task question", () => {
    expect(tutorRequestSchema.safeParse({ message: "Jak napisać tezę?" }).success).toBe(true);
    expect(tutorRequestSchema.safeParse({ message: "Pomóż", examId: "2026-maj-polski-pp", groupNo: 1 }).success).toBe(true);
  });

  it("rejects empty, too long, or half a task", () => {
    expect(tutorRequestSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ message: "x".repeat(TUTOR_LIMITS.messageChars + 1) }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ message: "Hej", examId: "2026-maj-polski-pp" }).success).toBe(false);
  });
});

describe("prompt building", () => {
  it("keeps the system prompt free of student data (cacheable) and states the rules", () => {
    const p = buildTutorInstructions();
    expect(p).toContain("NIGDY nie wymyślaj treści tekstu");
    expect(p).toContain("116 111");
    expect(buildTutorInstructions()).toBe(p);
  });

  it("describes the task, the key and the student's answers", () => {
    const text = buildTaskContext(ctx, { "1": "PF_" });
    expect(text).toContain("Zadanie 1: Prawda czy fałsz");
    expect(text).toContain("strona 6");
    expect(text).toContain("klucz: 1. P, 2. P, 3. P");
    expect(text).toContain("- 1: PF·");
    expect(buildTaskContext(ctx, { "1": "___" })).toContain("nie wpisał jeszcze");
  });

  it("sends the context first and only recent history", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }) as const);
    const input = buildTutorInput([...history], "CTX");
    expect(input[0]).toEqual({ role: "developer", content: "CTX" });
    expect(input).toHaveLength(TUTOR_LIMITS.historyMessages + 1);
    expect(input.at(-1)?.content).toBe("m29");
  });

  it("titles chats by task or by the first question", () => {
    expect(chatTitle("cokolwiek", ctx)).toBe("Zadanie 1 · Język polski, poziom podstawowy, maj 2026");
    expect(chatTitle("Jak  napisać\ntezę?", null)).toBe("Jak napisać tezę?");
    expect(chatTitle("a".repeat(100), null)).toHaveLength(58);
  });
});
