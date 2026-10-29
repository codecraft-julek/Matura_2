import { describe, expect, it } from "vitest";
import {
  NOTE_LIMITS,
  NotNotesError,
  buildNotesInput,
  buildNotesInstructions,
  normalizeBlock,
  normalizeNote,
  noteRequestSchema,
  openAiNoteSchema,
  type AiNote,
  type NoteBlock,
} from "./notes";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

const ai = (blocks: NoteBlock[], extra: Partial<AiNote> = {}): AiNote => ({
  title: "Romantyzm",
  transcript: "",
  summary: ["Epoka uczuć i wyobraźni."],
  blocks,
  flashcards: [{ front: "Mesjanizm", back: "Polska jako Chrystus narodów" }],
  quiz: [{ question: "Kiedy?", options: ["1822", "1830", "1863", "1918"], correct: 0, explanation: "Ballady i romanse." }],
  warnings: [],
  ...extra,
});

const timeline = (n: number): NoteBlock => ({
  type: "timeline",
  heading: "Oś czasu",
  events: Array.from({ length: n }, (_, i) => ({ date: `18${20 + i}`, label: `Wydarzenie ${i}` })),
  from_notes: true,
});

describe("noteRequestSchema", () => {
  it("accepts text or photos, rejects too little or wrong files", () => {
    expect(noteRequestSchema.safeParse({ subject: "polish", text: "x".repeat(NOTE_LIMITS.minTextChars) }).success).toBe(true);
    expect(noteRequestSchema.safeParse({ subject: "english", images: [PNG] }).success).toBe(true);
    expect(noteRequestSchema.safeParse({ subject: "polish", text: "za mało" }).success).toBe(false);
    expect(noteRequestSchema.safeParse({ subject: "polish", images: ["data:text/html;base64,PGI+"] }).success).toBe(false);
    expect(noteRequestSchema.safeParse({ subject: "polish", images: Array(5).fill(PNG) }).success).toBe(false);
  });
});

describe("normalizeBlock (our rules)", () => {
  it("turns a timeline with fewer than 3 events into a list", () => {
    expect(normalizeBlock(timeline(2))?.type).toBe("list");
    expect(normalizeBlock(timeline(3))?.type).toBe("timeline");
  });

  it("pads or cuts comparison rows to the number of columns", () => {
    const b = normalizeBlock({
      type: "compare",
      heading: "Epoki",
      columns: ["Romantyzm", "Pozytywizm"],
      rows: [{ feature: "Hasło", values: ["uczucie"] }, { feature: "Ideał", values: ["bohater", "praca", "nadmiar"] }],
      from_notes: true,
    });
    expect(b).toMatchObject({ type: "compare", rows: [{ values: ["uczucie", "–"] }, { values: ["bohater", "praca"] }] });
  });

  it("turns a one-column table and a one-branch mind map into lists", () => {
    expect(normalizeBlock({ type: "compare", heading: "x", columns: ["A"], rows: [{ feature: "f", values: ["v"] }], from_notes: true })?.type).toBe("list");
    expect(normalizeBlock({ type: "mindmap", center: "Lalka", branches: [{ label: "Wokulski", items: [] }], from_notes: true })?.type).toBe(
      "list",
    );
  });

  it("caps mind map branches and drops empty blocks", () => {
    const branches = Array.from({ length: 9 }, (_, i) => ({ label: `B${i}`, items: ["a", "b", "c", "d", "e", "f"] }));
    const b = normalizeBlock({ type: "mindmap", center: "Lalka", branches, from_notes: true });
    expect(b?.type === "mindmap" && b.branches.length).toBe(6);
    expect(b?.type === "mindmap" && b.branches[0].items.length).toBe(5);
    expect(normalizeBlock({ type: "text", heading: "", body: "   ", from_notes: true })).toBeNull();
  });
});

describe("normalizeNote", () => {
  it("allows at most 4 diagrams; extra ones become lists", () => {
    const note = normalizeNote(ai(Array.from({ length: 6 }, () => timeline(3))));
    expect(note.blocks.map((b) => b.type)).toEqual(["timeline", "timeline", "timeline", "timeline", "list", "list"]);
  });

  it("drops broken quiz questions", () => {
    const note = normalizeNote(
      ai([timeline(3)], {
        quiz: [
          { question: "OK?", options: ["a", "b", "c", "d"], correct: 2, explanation: "" },
          { question: "3 opcje", options: ["a", "b", "c"], correct: 0, explanation: "" },
          { question: "zły indeks", options: ["a", "b", "c", "d"], correct: 7, explanation: "" },
        ],
      }),
    );
    expect(note.quiz.map((q) => q.question)).toEqual(["OK?"]);
  });

  it("refuses material that isn't notes", () => {
    expect(() => normalizeNote(ai([], { summary: [], warnings: ["To zdjęcie kota."] }))).toThrow(NotNotesError);
  });
});

describe("prompt and schema", () => {
  it("is strict JSON schema with all block types", () => {
    const schema = openAiNoteSchema() as { properties: { blocks: { items: { anyOf: { properties: { type: { enum: string[] } } }[] } } } };
    const types = schema.properties.blocks.items.anyOf.map((b) => b.properties.type.enum[0]);
    expect(types.sort()).toEqual(["cause_effect", "compare", "definition", "list", "mindmap", "remember", "text", "timeline"]);
  });

  it("sends text and photos, and the prompt is subject-specific but student-free", () => {
    const input = buildNotesInput({ text: "Romantyzm 1822–1863", images: [PNG] });
    expect(input[0].content.map((c) => c.type)).toEqual(["input_text", "input_image"]);
    expect(buildNotesInstructions("english")).toContain("po angielsku");
    const fromFile = buildNotesInput({ text: "Barok…", images: [], file: { kind: "pptx", name: "barok" } });
    expect((fromFile[0].content[0] as { text: string }).text).toContain("prezentację PowerPoint „barok”");
    expect(buildNotesInstructions("polish")).toBe(buildNotesInstructions("polish"));
  });
});
