import { z } from "zod";

// AI notes, shared by the Edge Function `notes-generate` (Deno) and the website (Next.js).
// Keep this file free of Node- or Deno-specific code.
//
// How it works: the AI does NOT write the note as free text. It returns a list of "blocks" from a
// fixed menu (timeline, comparison table, mind map, ...) in a strict JSON format, and the website
// draws each block with its own component. normalizeNote() then enforces our rules in code
// (e.g. a timeline needs 3+ events, a mind map 2–6 branches), so a bad choice by the AI becomes a
// plain list instead of a broken diagram.

export const NOTE_LIMITS = {
  /** Pasted text, or text read from a PDF / Word / PowerPoint file in the browser. */
  textChars: 30_000,
  /** Photos per note (each shrunk in the browser to max 1600 px, JPEG). */
  images: 4,
  /** One photo as a data URL, after shrinking (~1.2 MB of JPEG). */
  imageChars: 1_700_000,
  /** Too little to make a note from. */
  minTextChars: 40,
  /** Diagram blocks per note, so it doesn't get overloaded. */
  diagrams: 4,
} as const;

export const SUBJECTS = ["polish", "english", "other"] as const;
export type NoteSubject = (typeof SUBJECTS)[number];

export const noteRequestSchema = z
  .object({
    subject: z.enum(SUBJECTS),
    text: z.string().trim().max(NOTE_LIMITS.textChars).default(""),
    images: z
      .array(
        z
          .string()
          .max(NOTE_LIMITS.imageChars)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
      )
      .max(NOTE_LIMITS.images)
      .default([]),
    /** The file the text (or scanned pages) came from, if any. */
    file: z.object({ kind: z.enum(["pdf", "docx", "pptx"]), name: z.string().trim().max(200) }).optional(),
  })
  .refine((r) => r.images.length > 0 || r.text.length >= NOTE_LIMITS.minTextChars, {
    message: "too_little",
    path: ["text"],
  });
export type NoteRequest = z.input<typeof noteRequestSchema>;

// ─── The block menu (what the AI returns, before our rules) ─────────────────
const s = z.string();
const strs = z.array(z.string());
const flag = { from_notes: z.boolean() };

const textBlock = z.object({ type: z.literal("text"), heading: s, body: s, ...flag });
const listBlock = z.object({ type: z.literal("list"), heading: s, numbered: z.boolean(), items: strs, ...flag });
const definitionBlock = z.object({ type: z.literal("definition"), term: s, meaning: s, example: s, ...flag });
const timelineBlock = z.object({
  type: z.literal("timeline"),
  heading: s,
  events: z.array(z.object({ date: s, label: s })),
  ...flag,
});
const compareBlock = z.object({
  type: z.literal("compare"),
  heading: s,
  columns: strs,
  rows: z.array(z.object({ feature: s, values: strs })),
  ...flag,
});
const mindmapBlock = z.object({
  type: z.literal("mindmap"),
  center: s,
  branches: z.array(z.object({ label: s, items: strs })),
  ...flag,
});
const causeEffectBlock = z.object({
  type: z.literal("cause_effect"),
  heading: s,
  causes: strs,
  event: s,
  effects: strs,
  ...flag,
});
const rememberBlock = z.object({ type: z.literal("remember"), items: strs, ...flag });

const blockSchema = z.discriminatedUnion("type", [
  textBlock,
  listBlock,
  definitionBlock,
  timelineBlock,
  compareBlock,
  mindmapBlock,
  causeEffectBlock,
  rememberBlock,
]);
export type NoteBlock = z.infer<typeof blockSchema>;
export type BlockType = NoteBlock["type"];

export const aiNoteSchema = z.object({
  title: s,
  /** What the AI read from the photos (empty when there were none). Shown so students can check it. */
  transcript: s,
  summary: strs,
  blocks: z.array(blockSchema),
  flashcards: z.array(z.object({ front: s, back: s })),
  quiz: z.array(z.object({ question: s, options: strs, correct: z.number().int(), explanation: s })),
  warnings: strs,
});
export type AiNote = z.infer<typeof aiNoteSchema>;

/** What we save in notes.note and the website draws. */
export type StoredNote = Omit<AiNote, "transcript"> & { version: 1 };

const DIAGRAMS: BlockType[] = ["timeline", "compare", "mindmap", "cause_effect"];

// ─── JSON Schema for OpenAI Structured Outputs (strict: every field required, no extras) ───
const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const arr = (items: object, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const obj = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const fromNotes = {
  type: "boolean",
  description: "true = treść z materiału ucznia; false = coś, co dodajesz od siebie (wyjaśnienie, brakujący fakt).",
};
const typeTag = (t: BlockType) => ({ type: "string", enum: [t] });

export function openAiNoteSchema() {
  const blocks = [
    obj({ type: typeTag("text"), heading: str(), body: str("1–3 krótkie zdania"), from_notes: fromNotes }),
    obj({ type: typeTag("list"), heading: str(), numbered: { type: "boolean" }, items: arr(str()), from_notes: fromNotes }),
    obj({ type: typeTag("definition"), term: str(), meaning: str(), example: str("może być pusty"), from_notes: fromNotes }),
    obj({
      type: typeTag("timeline"),
      heading: str(),
      events: arr(obj({ date: str("np. 1830, XIX w., 1918–1939"), label: str() })),
      from_notes: fromNotes,
    }),
    obj({
      type: typeTag("compare"),
      heading: str(),
      columns: arr(str(), "2–4 porównywane rzeczy"),
      rows: arr(obj({ feature: str("cecha"), values: arr(str(), "po jednej wartości na kolumnę") })),
      from_notes: fromNotes,
    }),
    obj({
      type: typeTag("mindmap"),
      center: str("temat główny"),
      branches: arr(obj({ label: str(), items: arr(str(), "0–5 krótkich haseł") }), "2–6 gałęzi"),
      from_notes: fromNotes,
    }),
    obj({
      type: typeTag("cause_effect"),
      heading: str(),
      causes: arr(str()),
      event: str("zjawisko lub wydarzenie w środku"),
      effects: arr(str()),
      from_notes: fromNotes,
    }),
    obj({ type: typeTag("remember"), items: arr(str(), "1–6 rzeczy ważnych na maturę"), from_notes: fromNotes }),
  ];
  return obj({
    title: str("krótki tytuł notatki"),
    transcript: str("dokładnie odczytany tekst ze zdjęć; pusty, gdy nie było zdjęć"),
    summary: arr(str(), "2–4 punkty „w skrócie”"),
    blocks: arr({ anyOf: blocks }, "4–10 bloków"),
    flashcards: arr(obj({ front: str(), back: str() }), "5–10 fiszek"),
    quiz: arr(
      obj({
        question: str(),
        options: arr(str(), "dokładnie 4 odpowiedzi"),
        correct: { type: "integer", description: "indeks poprawnej odpowiedzi 0–3" },
        explanation: str("1 zdanie"),
      }),
      "3–5 pytań",
    ),
    warnings: arr(str(), "np. nieczytelny fragment zdjęcia; pusta lista, gdy wszystko jest OK"),
  });
}

// ─── Prompt ──────────────────────────────────────────────────────────────────
const SUBJECT_HINT: Record<NoteSubject, string> = {
  polish: "Przedmiot: język polski (matura). Typowe tematy: epoki, lektury, bohaterowie, motywy, środki stylistyczne.",
  english:
    "Przedmiot: język angielski (matura). Wyjaśnienia pisz po polsku, a przykłady, słówka i zwroty po angielsku. Fiszki: przód po angielsku, tył po polsku.",
  other: "Przedmiot: inny. Dopasuj bloki do treści.",
};

/** System prompt. Depends only on the subject, so OpenAI can cache it. */
export function buildNotesInstructions(subject: NoteSubject): string {
  return `Jesteś autorem świetnych notatek do nauki w aplikacji „Ogarnij Maturę”. Uczeń przysłał swoje notatki (wklejony tekst i/lub zdjęcia zeszytu albo podręcznika). Zamień je w przejrzystą notatkę do powtórki przed maturą.
${SUBJECT_HINT[subject]}

KROK 1: ODCZYTAJ
- Jeśli są zdjęcia, przepisz wiernie ich treść edukacyjną do pola "transcript" (pismo odręczne też). Pomiń dane osobowe (imiona i nazwiska uczniów, telefony, adresy).
- Nieczytelne fragmenty oznacz jako [nieczytelne] i dodaj krótkie ostrzeżenie do "warnings".
- Jeśli materiał nie wygląda na notatki do nauki, zwróć pustą listę "blocks" i wyjaśnij to w "warnings".

KROK 2: ZBUDUJ NOTATKĘ Z BLOKÓW
Wybierz bloki, które najlepiej pokażą treść. Używaj TYLKO tych typów:
- "timeline" (oś czasu): co najmniej 3 wydarzenia z datami (epoki, historia, biografia autora).
- "compare" (tabela porównawcza): 2–4 rzeczy porównane według tych samych cech (np. romantyzm i pozytywizm, Present Perfect i Past Simple). Każdy wiersz ma po jednej wartości na kolumnę.
- "mindmap" (mapa myśli): jeden temat i 2–6 gałęzi z krótkimi hasłami (np. bohaterowie i motywy lektury).
- "cause_effect" (przyczyny → zjawisko → skutki): gdy coś z czegoś wynika (np. przyczyny i skutki powstania).
- "definition": pojęcie, jego znaczenie i krótki przykład (np. „ironia romantyczna”).
- "list": wyliczenie albo kroki (numbered=true dla kolejnych kroków, np. jak napisać rozprawkę).
- "remember": rzeczy, które często pojawiają się na maturze, i typowe pułapki.
- "text": krótki akapit, gdy nic innego nie pasuje.

ZASADY
- Opieraj się na materiale ucznia. Możesz dodać krótkie wyjaśnienie albo brakujący kluczowy fakt tylko wtedy, gdy masz pewność. Taki blok oznacz from_notes=false.
- Nie wymyślaj dat, cytatów, tytułów ani nazwisk. Jeśli w notatkach jest błąd merytoryczny, nie powtarzaj go: popraw w bloku "text" z from_notes=false, zaczynając od „Uwaga:”.
- 4–10 bloków, najwyżej ${NOTE_LIMITS.diagrams} diagramy (timeline, compare, mindmap, cause_effect). Najważniejsze na początku.
- Krótko i konkretnie: hasła i krótkie zdania, bez lania wody. Bez znaczników Markdown (bez **, #, -), bez emoji.
- "summary": 2–4 punkty z sednem tematu.
- "flashcards": 5–10 fiszek z najważniejszych faktów i pojęć (pytanie/hasło z przodu, odpowiedź z tyłu).
- "quiz": 3–5 pytań jednokrotnego wyboru, dokładnie 4 odpowiedzi, jedna poprawna, krótkie wyjaśnienie.
- Pisz po polsku (poza przykładami po angielsku przy języku angielskim).`;
}

const FILE_KIND = { pdf: "PDF", docx: "dokument Word", pptx: "prezentację PowerPoint" } as const;

/** Input for the OpenAI Responses API: the text (pasted or from a file) and the photos / scanned pages. */
export function buildNotesInput(r: { text: string; images: string[]; file?: { kind: keyof typeof FILE_KIND; name: string } }) {
  const parts: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" })[] = [];
  const intro = r.file
    ? `Uczeń przysłał ${FILE_KIND[r.file.kind]} „${r.file.name}”${r.images.length ? " (skan: strony jako obrazy)" : ""}. Zrób notatkę z jego treści.`
    : r.images.length
      ? `Uczeń przysłał ${r.images.length} ${r.images.length === 1 ? "zdjęcie" : "zdjęcia"} notatek${r.text ? " i tekst" : ""}.`
      : "Uczeń przysłał tekst notatek.";
  parts.push({ type: "input_text", text: r.text ? `${intro}\n\nTEKST UCZNIA:\n${r.text}` : intro });
  for (const url of r.images) parts.push({ type: "input_image", image_url: url, detail: "high" });
  return [{ role: "user" as const, content: parts }];
}

// ─── Our rules, applied after the AI ─────────────────────────────────────────
const clip = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);
const clipAll = (list: string[], n: number, max: number) =>
  list
    .map((v) => clip(v, n))
    .filter(Boolean)
    .slice(0, max);

function asList(heading: string, items: string[], from_notes: boolean): NoteBlock | null {
  const clean = clipAll(items, 240, 12);
  return clean.length ? { type: "list", heading: clip(heading, 120), numbered: false, items: clean, from_notes } : null;
}

/** One block through our rules: fixed up, turned into a simpler block, or dropped (null). */
export function normalizeBlock(b: NoteBlock): NoteBlock | null {
  switch (b.type) {
    case "text": {
      const body = clip(b.body, 1200);
      return body ? { ...b, heading: clip(b.heading, 120), body } : null;
    }
    case "list": {
      const items = clipAll(b.items, 240, 12);
      return items.length ? { ...b, heading: clip(b.heading, 120), items } : null;
    }
    case "definition": {
      const term = clip(b.term, 120);
      const meaning = clip(b.meaning, 600);
      return term && meaning ? { ...b, term, meaning, example: clip(b.example, 300) } : null;
    }
    case "remember": {
      const items = clipAll(b.items, 240, 6);
      return items.length ? { ...b, items } : null;
    }
    case "timeline": {
      const events = b.events
        .map((e) => ({ date: clip(e.date, 40), label: clip(e.label, 200) }))
        .filter((e) => e.date && e.label)
        .slice(0, 12);
      if (events.length < 3) {
        return asList(b.heading, b.events.map((e) => [clip(e.date, 40), clip(e.label, 200)].filter(Boolean).join(" – ")), b.from_notes);
      }
      return { ...b, heading: clip(b.heading, 120), events };
    }
    case "compare": {
      const columns = clipAll(b.columns, 60, 4);
      const rows = b.rows
        .map((r) => ({
          feature: clip(r.feature, 80),
          values: columns.map((_, i) => clip(r.values[i] ?? "", 200) || "–"),
        }))
        .filter((r) => r.feature && r.values.some((v) => v !== "–"))
        .slice(0, 8);
      if (columns.length < 2 || rows.length === 0) {
        return asList(b.heading, b.rows.map((r) => `${r.feature}: ${r.values.join(" / ")}`), b.from_notes);
      }
      return { ...b, heading: clip(b.heading, 120), columns, rows };
    }
    case "mindmap": {
      const branches = b.branches
        .map((br) => ({ label: clip(br.label, 60), items: clipAll(br.items, 80, 5) }))
        .filter((br) => br.label)
        .slice(0, 6);
      if (branches.length < 2) {
        return asList(b.center, branches.flatMap((br) => [br.label, ...br.items]), b.from_notes);
      }
      return { ...b, center: clip(b.center, 80) || "Temat", branches };
    }
    case "cause_effect": {
      const causes = clipAll(b.causes, 200, 5);
      const effects = clipAll(b.effects, 200, 5);
      const event = clip(b.event, 160);
      if (!event || (causes.length === 0 && effects.length === 0)) {
        return asList(b.heading, [...causes, event, ...effects], b.from_notes);
      }
      return { ...b, heading: clip(b.heading, 120), causes, event, effects };
    }
  }
}

/** Thrown when the material isn't study notes (e.g. a random photo): nothing to save. */
export class NotNotesError extends Error {}

/** Applies all our rules to the AI's answer. */
export function normalizeNote(ai: AiNote): StoredNote {
  let diagrams = 0;
  const blocks: NoteBlock[] = [];
  for (const raw of ai.blocks) {
    let b = normalizeBlock(raw);
    if (!b) continue;
    if (DIAGRAMS.includes(b.type)) {
      diagrams += 1;
      // Too many diagrams make a note hard to read: extra ones become lists.
      if (diagrams > NOTE_LIMITS.diagrams) b = normalizeBlock(downgrade(b));
      if (!b) continue;
    }
    blocks.push(b);
    if (blocks.length >= 16) break;
  }

  const summary = clipAll(ai.summary, 240, 4);
  if (blocks.length === 0 && summary.length === 0) throw new NotNotesError(ai.warnings.join(" ") || "no content");

  return {
    version: 1,
    title: clip(ai.title, 120) || "Notatka",
    summary,
    blocks,
    flashcards: ai.flashcards
      .map((f) => ({ front: clip(f.front, 200), back: clip(f.back, 400) }))
      .filter((f) => f.front && f.back)
      .slice(0, 12),
    quiz: ai.quiz
      .map((q) => ({
        question: clip(q.question, 300),
        options: q.options.map((o) => clip(o, 160)),
        correct: q.correct,
        explanation: clip(q.explanation, 400),
      }))
      .filter((q) => q.question && q.options.length === 4 && q.options.every(Boolean) && q.correct >= 0 && q.correct <= 3)
      .slice(0, 5),
    warnings: clipAll(ai.warnings, 300, 3),
  };
}

/** A diagram as a plain list (used when there are too many diagrams). */
function downgrade(b: NoteBlock): NoteBlock {
  const list = (heading: string, items: string[]): NoteBlock => ({ type: "list", heading, numbered: false, items, from_notes: b.from_notes });
  switch (b.type) {
    case "timeline":
      return list(b.heading, b.events.map((e) => `${e.date} – ${e.label}`));
    case "compare":
      return list(b.heading, b.rows.map((r) => `${r.feature}: ${r.values.join(" / ")}`));
    case "mindmap":
      return list(b.center, b.branches.map((br) => (br.items.length ? `${br.label}: ${br.items.join(", ")}` : br.label)));
    case "cause_effect":
      return list(b.heading, [...b.causes.map((c) => `Przyczyna: ${c}`), b.event, ...b.effects.map((e) => `Skutek: ${e}`)]);
    default:
      return b;
  }
}
