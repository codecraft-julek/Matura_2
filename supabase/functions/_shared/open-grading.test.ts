import { describe, expect, it } from "vitest";
import {
  MAX_ANSWER_CHARS,
  buildGradingInput,
  buildGradingInstructions,
  gradeRequestSchema,
  normalizeGrades,
  openAiGradesSchema,
  type GradableTask,
} from "./open-grading";

const task = (number: string, max: number, answer = "Odpowiedź ucznia."): GradableTask => ({
  number,
  max,
  hint: "Odpowiedz pełnym zdaniem.",
  scoring: "Opis tego, za co są punkty.",
  note: max > 1 ? "1 pkt za jeden argument." : null,
  answer,
});

describe("gradeRequestSchema", () => {
  it("accepts only an attempt id", () => {
    expect(gradeRequestSchema.safeParse({ attemptId: "6f9619ff-8b86-4011-b42d-00c04fc964ff" }).success).toBe(true);
    expect(gradeRequestSchema.safeParse({ attemptId: "nope" }).success).toBe(false);
    expect(gradeRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("normalizeGrades", () => {
  it("clamps points, drops unknown tasks and keeps the task order", () => {
    const tasks = [task("1", 1), task("2", 2), task("3", 2)];
    const grades = normalizeGrades(tasks, {
      grades: [
        { number: "2", points: 5, reason: "  Za dużo.  ", uncertain: false },
        { number: "99", points: 1, reason: "Obce zadanie.", uncertain: false },
        { number: "1", points: -3, reason: "Za mało.", uncertain: true },
      ],
    });
    expect(grades).toEqual([
      { number: "1", points: 0, reason: "Za mało.", uncertain: true },
      { number: "2", points: 2, reason: "Za dużo.", uncertain: false },
    ]);
  });
});

describe("prompt", () => {
  it("tells the AI it has no source text and must flag uncertainty", () => {
    const text = buildGradingInstructions();
    expect(text).toMatch(/nie masz tekstu źródłowego/);
    expect(text).toMatch(/uncertain/);
  });

  it("includes scoring, max points and a trimmed answer", () => {
    const input = buildGradingInput([task("7.1", 1, "x".repeat(MAX_ANSWER_CHARS + 100))]);
    expect(input).toContain("Zadanie 7.1 (maks. 1 pkt)");
    expect(input).toContain("Za co są punkty: Opis tego, za co są punkty.");
    expect(input).not.toContain("x".repeat(MAX_ANSWER_CHARS + 1));
  });

  it("OpenAI schema only allows the task numbers we sent", () => {
    const schema = openAiGradesSchema(["1", "2"]) as {
      properties: { grades: { items: { properties: { number: { enum: string[] } } } } };
    };
    expect(schema.properties.grades.items.properties.number.enum).toEqual(["1", "2"]);
  });
});
