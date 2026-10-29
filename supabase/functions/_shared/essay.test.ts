import { describe, expect, it } from "vitest";
import {
  RUBRICS,
  applyCkeRules,
  buildInput,
  essayRequestSchema,
  openAiSchema,
  parsePartialFeedback,
  rubricFor,
  type AiFeedback,
  type RubricId,
} from "./essay";

const total = (r: RubricId) => RUBRICS[r].criteria.reduce((s, c) => s + c.max, 0);

// AI answer that gives every criterion its maximum (we then check what our rules do with it).
function perfect(rubric: RubricId, quotes: string[] = []): AiFeedback {
  return {
    summary: "OK",
    criteria: RUBRICS[rubric].criteria.map((c) => ({ id: c.id, points: c.max, verdict: "good", comment: "" })),
    highlights: quotes.map((q) => ({ quote: q, type: "good", comment: "" })),
    top_tip: "tip",
  };
}

describe("rubrics", () => {
  it("match the official CKE maxima", () => {
    expect(total("polish_basic")).toBe(35);
    expect(total("polish_extended")).toBe(35);
    expect(total("english_basic")).toBe(12);
    expect(total("english_extended")).toBe(13);
  });

  it("picks the rubric by subject and level", () => {
    expect(rubricFor("polish_essay", "basic")).toBe("polish_basic");
    expect(rubricFor("polish_essay", "extended")).toBe("polish_extended");
    expect(rubricFor("english_writing", "extended")).toBe("english_extended");
  });

  it("OpenAI schema only allows our criterion ids", () => {
    const schema = openAiSchema("english_basic") as { properties: { criteria: { items: { properties: { id: { enum: string[] } } } } } };
    expect(schema.properties.criteria.items.properties.id.enum).toEqual(["content", "coherence", "range", "accuracy"]);
  });
});

describe("applyCkeRules", () => {
  const content = "Miłość, która staje się obsesją, potrafi zniszczyć człowieka. Dalszy tekst.";

  it("clamps points to each criterion's range", () => {
    const ai = perfect("english_basic");
    ai.criteria[0].points = 99;
    ai.criteria[1].points = -3;
    const fb = applyCkeRules("english_basic", ai, { content, words: 120, hasPrompt: true });
    expect(fb.criteria[0].points).toBe(5);
    expect(fb.criteria[1].points).toBe(0);
  });

  it("keeps only quotes that really appear in the text", () => {
    const fb = applyCkeRules("polish_basic", perfect("polish_basic", ["potrafi zniszczyć człowieka", "zmyślony cytat"]), {
      content,
      words: 350,
      hasPrompt: true,
    });
    expect(fb.highlights.map((h) => h.quote)).toEqual(["potrafi zniszczyć człowieka"]);
    expect(fb.total).toBe(35);
  });

  it("Polish under 300 words: only formal conditions and literary competences count", () => {
    const fb = applyCkeRules("polish_basic", perfect("polish_basic"), { content, words: 250, hasPrompt: true });
    expect(fb.total).toBe(1 + 16);
    expect(fb.notes[0]).toMatch(/250 wyrazów/);
  });

  it("Polish with 0 in formal conditions: everything is 0", () => {
    const ai = perfect("polish_basic");
    ai.criteria.find((c) => c.id === "formal")!.points = 0;
    const fb = applyCkeRules("polish_basic", ai, { content, words: 400, hasPrompt: true });
    expect(fb.total).toBe(0);
  });

  it("Polish extended: the exam's own minimum wins (500 words in 2023–2024, 400 since 2025)", () => {
    const short = applyCkeRules("polish_extended", perfect("polish_extended"), { content, words: 450, hasPrompt: true, minWords: 500 });
    expect(short.total).toBe(1 + 16);
    expect(short.notes[0]).toMatch(/co najmniej 500/);
    const ok = applyCkeRules("polish_extended", perfect("polish_extended"), { content, words: 450, hasPrompt: true });
    expect(ok.total).toBe(35);
  });

  it("Polish with 0 in literary competences: composition and language are 0 too", () => {
    for (const rubric of ["polish_basic", "polish_extended"] as const) {
      const ai = perfect(rubric);
      ai.criteria.find((c) => c.id === "literary")!.points = 0;
      const fb = applyCkeRules(rubric, ai, { content, words: 600, hasPrompt: true });
      expect(fb.total).toBe(1);
    }
  });

  it("English basic without the task instructions: 'Treść' isn't assessed or counted", () => {
    const fb = applyCkeRules("english_basic", perfect("english_basic"), { content, words: 120, hasPrompt: false });
    expect(fb.criteria.find((c) => c.id === "content")?.assessed).toBe(false);
    expect(fb.max).toBe(7);
    expect(fb.total).toBe(7);
  });

  it("English extended under 160 words: only 'Zgodność z poleceniem' counts", () => {
    const fb = applyCkeRules("english_extended", perfect("english_extended"), { content, words: 150, hasPrompt: true });
    expect(fb.total).toBe(5);
  });
});

describe("essayRequestSchema", () => {
  it("accepts a Polish essay and an exam request", () => {
    expect(essayRequestSchema.safeParse({ mode: "polish", topic: "Czy warto?", content: "tekst" }).success).toBe(true);
    expect(
      essayRequestSchema.safeParse({ mode: "exam", attemptId: "4f8c2a52-0b4e-4a6e-9d1c-2b2c7f1d9e10", taskNumber: "12" }).success,
    ).toBe(true);
  });

  it("defaults a Polish essay to the basic level", () => {
    const parsed = essayRequestSchema.parse({ mode: "polish", topic: "Czy warto?", content: "tekst" });
    expect(parsed.mode === "polish" && parsed.level).toBe("basic");
    expect(essayRequestSchema.safeParse({ mode: "polish", level: "extended", topic: "Czy warto?", content: "tekst" }).success).toBe(true);
    expect(essayRequestSchema.safeParse({ mode: "polish", level: "expert", topic: "Czy warto?", content: "tekst" }).success).toBe(false);
  });

  it("rejects a missing topic and a bad task number", () => {
    expect(essayRequestSchema.safeParse({ mode: "polish", topic: "", content: "tekst" }).success).toBe(false);
    expect(
      essayRequestSchema.safeParse({ mode: "exam", attemptId: "4f8c2a52-0b4e-4a6e-9d1c-2b2c7f1d9e10", taskNumber: "1.1" }).success,
    ).toBe(false);
  });
});

describe("parsePartialFeedback", () => {
  it("reads finished parts of an unfinished stream", () => {
    const partial =
      '{"summary":"Dobra praca, ale \\"kontekst\\" do poprawy.","criteria":[{"id":"formal","points":1,"verdict":"good","comment":"OK."},{"id":"literary","points":11,"verdict":"ok","comment":"Dwa utw';
    const p = parsePartialFeedback(partial);
    expect(p.summary).toBe('Dobra praca, ale "kontekst" do poprawy.');
    expect(p.criteria).toEqual([{ id: "formal", points: 1, verdict: "good", comment: "OK." }]);
    expect(p.highlightsCount).toBe(0);
    expect(p.topTipStarted).toBe(false);
  });

  it("returns nothing (but doesn't crash) before the summary is complete", () => {
    const p = parsePartialFeedback('{"summ');
    expect(p.summary).toBeUndefined();
    expect(p.criteria).toEqual([]);
  });

  it("counts highlights and notices the tip", () => {
    const p = parsePartialFeedback('..."highlights":[{"quote":"a","type":"good","comment":"x"},{"quote":"b"... "top_tip":"Dod');
    expect(p.highlightsCount).toBe(2);
    expect(p.topTipStarted).toBe(true);
  });
});

describe("buildInput", () => {
  it("passes the exam's own minimum and requirements to the AI", () => {
    const input = buildInput({
      topic: "Temat",
      content: "Tekst",
      words: 520,
      rubric: "polish_extended",
      minWords: 500,
      rules: ["Utwory z co najmniej dwóch epok."],
    });
    expect(input).toContain("wymagane minimum: 500");
    expect(input).toContain("WYMAGANIA TEGO ARKUSZA:\n- Utwory z co najmniej dwóch epok.");
    expect(buildInput({ topic: "", content: "Tekst", words: 10, rubric: "polish_extended" })).not.toContain("WYMAGANIA");
  });
});
