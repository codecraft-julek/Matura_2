import { describe, expect, it } from "vitest";
import {
  TUTOR_LIMITS,
  buildTaskContext,
  buildTutorInput,
  buildSubjectContext,
  buildTutorInstructions,
  chatTitle,
  deckMarkerFilter,
  splitDeckProposal,
  tutorRequestSchema,
  wantsFlashcards,
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

  it("tells the tutor which subject a general chat is about, and nothing for an unknown one", () => {
    expect(buildSubjectContext("biology")).toContain("biologia");
    expect(buildSubjectContext(undefined)).toBeNull();
    expect(tutorRequestSchema.safeParse({ message: "Hej", subject: "biology" }).success).toBe(true);
    expect(tutorRequestSchema.safeParse({ message: "Hej", subject: "maths" }).success).toBe(false);
  });

  it("asks for diagrams only from pages that can draw them", () => {
    expect(buildTutorInstructions()).not.toContain("```diagram");
    const withDiagrams = buildTutorInstructions({ diagrams: true });
    expect(withDiagrams).toContain("DIAGRAMY");
    expect(withDiagrams).toContain("```diagram\n{");
    expect(tutorRequestSchema.safeParse({ message: "Hej", diagrams: true }).success).toBe(true);
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

describe("deck proposals", () => {
  const ok = '[[FISZKI]]{"topic":"Romantyzm","count":20,"subject":"polish"}';
  it("takes a valid proposal off the end of the reply", () => {
    expect(splitDeckProposal(`Jasne, zrób talię przyciskiem.\n${ok}`)).toEqual({
      text: "Jasne, zrób talię przyciskiem.",
      proposal: { topic: "Romantyzm", count: 20, subject: "polish" },
    });
  });
  it("leaves a normal reply alone", () => {
    expect(splitDeckProposal("Zwykła odpowiedź.")).toEqual({ text: "Zwykła odpowiedź.", proposal: null });
  });
  it.each([
    ["not JSON", "[[FISZKI]]zrób 1000 fiszek"],
    ["a count we don't offer", '[[FISZKI]]{"topic":"Romantyzm","count":500,"subject":"polish"}'],
    ["a wrong subject", '[[FISZKI]]{"topic":"Romantyzm","count":20,"subject":"math"}'],
    ["a topic too short", '[[FISZKI]]{"topic":"x","count":20,"subject":"polish"}'],
    ["a topic too long", `[[FISZKI]]{"topic":"${"a".repeat(121)}","count":20,"subject":"polish"}`],
    ["markup in the topic", '[[FISZKI]]{"topic":"<img src=x onerror=alert(1)>","count":20,"subject":"polish"}'],
    ["a marker in the topic", '[[FISZKI]]{"topic":"[[FISZKI]] x","count":20,"subject":"polish"}'],
    ["extra fields", '[[FISZKI]]{"topic":"Romantyzm","count":20,"subject":"polish","deckId":"1","userId":"2"}'],
    ["a missing field", '[[FISZKI]]{"topic":"Romantyzm"}'],
  ])("rejects %s but still hides the line", (_name, line) => {
    expect(splitDeckProposal(`Tekst.\n${line}`)).toEqual({ text: "Tekst.", proposal: null });
  });
  it("hides a marker cut off at the token limit", () => {
    expect(splitDeckProposal("Tekst.\n[[FISZ").text).toBe("Tekst.");
  });
  it("keeps text that only looks like the start of the marker", () => {
    expect(splitDeckProposal("Lista [a]").text).toBe("Lista [a]");
  });
  it("never saves an empty reply", () => {
    expect(splitDeckProposal(ok).text.length).toBeGreaterThan(0);
  });
  it.each(["Zrób mi fiszki z romantyzmu", "fiszek poproszę", "Utwórz talię z tego", "flashcards please", "Zrób TALIĘ"])("sees a request in: %s", (m) => {
    expect(wantsFlashcards(m)).toBe(true);
  });
  it.each(["Wyjaśnij romantyzm", "Co to jest Italia?", "Jaka jest kapitalizacja?"])("sees no request in: %s", (m) => {
    expect(wantsFlashcards(m)).toBe(false);
  });
  it("never streams the marker, however the text is split", () => {
    const reply = `Jasne, gotowe [uwaga].\n${ok}`;
    for (const size of [1, 2, 3, 7, 1000]) {
      let shown = "";
      const filter = deckMarkerFilter((t) => { shown += t; });
      for (let i = 0; i < reply.length; i += size) filter(reply.slice(i, i + size));
      expect(shown).toBe("Jasne, gotowe [uwaga].\n");
    }
  });
  it("tells the tutor to propose only on request, and not to create anything", () => {
    const prompt = buildTutorInstructions();
    expect(prompt).toContain("Sam nie tworzysz fiszek");
    expect(prompt).toContain("[[FISZKI]]");
  });
});
