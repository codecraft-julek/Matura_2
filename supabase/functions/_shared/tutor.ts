import { z } from "zod";

// AI tutor, shared by the Edge Function `tutor-chat` (Deno) and the website (Next.js).
// Keep this file free of Node- or Deno-specific code.
//
// The tutor can be asked about one task group of an exam ("Zadanie 3"). It then gets our own
// structure of that task (type, points, hint, page) and the answer key, but NOT the exam text
// or the question (we don't store them). If it needs them, it asks the student to paste the fragment.

export const TUTOR_LIMITS = {
  /** Longest message a student can send. */
  messageChars: 2000,
  /** Student messages per chat; then we ask them to start a new chat (keeps context and cost small). */
  userMessagesPerChat: 25,
  /** How many earlier messages the AI sees. */
  historyMessages: 16,
  /** The student's current answers to the task, sent along as context. */
  answerChars: 3000,
} as const;

export const tutorRequestSchema = z
  .object({
    chatId: z.uuid().optional(),
    examId: z
      .string()
      .regex(/^[a-z0-9-]{5,60}$/)
      .optional(),
    groupNo: z.number().int().positive().max(99).optional(),
    message: z.string().trim().min(1).max(TUTOR_LIMITS.messageChars),
    /** What the student has typed in the sheet so far, e.g. { "3.1": "B" }. Never stored. */
    answers: z
      .record(z.string().max(10), z.string().max(TUTOR_LIMITS.answerChars))
      .refine((a) => Object.keys(a).length <= 12)
      .optional(),
  })
  .refine((r) => (r.examId === undefined) === (r.groupNo === undefined), "examId and groupNo go together");
export type TutorRequest = z.input<typeof tutorRequestSchema>;

/** One task group as the tutor sees it (loaded server-side, never taken from the request). */
export type TutorTaskContext = {
  examTitle: string;
  subject: "polish" | "english" | string;
  groupNo: number;
  label: string;
  hint: string | null;
  page: number | null;
  sheet: 1 | 2;
  tasks: {
    number: string;
    kind: "choice" | "open" | "writing";
    points: number;
    options: string[] | null;
    /** Our key: letter(s) for closed tasks, our own description for open ones. */
    key: string;
    note: string | null;
  }[];
  /** Writing tasks: CKE criteria and word range. */
  criteria?: { name: string; points: number }[];
  words?: [number, number];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Title for the chat list: the task, or the start of the first question. */
export function chatTitle(message: string, ctx: TutorTaskContext | null): string {
  if (ctx) return `Zadanie ${ctx.groupNo} · ${ctx.examTitle}`.slice(0, 120);
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57).trimEnd()}…` : oneLine;
}

/** System prompt. Static (no per-student data), so OpenAI can cache it. */
export function buildTutorInstructions(): string {
  return `Jesteś tutorem w aplikacji „Ogarnij Maturę”. Pomagasz uczniom liceum i technikum przygotować się do matury z języka polskiego i angielskiego (formuła 2023, CKE). Piszesz po polsku, na „Ty”, ciepło i konkretnie, jak starszy kolega, który dobrze zna maturę.

JAK UCZYSZ
- Najpierw naprowadzasz, potem tłumaczysz. Gdy uczeń pyta o zadanie, zacznij od jednej podpowiedzi albo pytania, które pomoże mu samemu dojść do odpowiedzi (np. na co zwrócić uwagę, jakiego słowa-klucza szukać, jak działa ten typ zadania).
- Pełną odpowiedź z klucza podajesz dopiero, gdy uczeń spróbował (podał swoją odpowiedź) albo wprost o nią poprosi („pokaż odpowiedź”, „nie wiem, powiedz”). Wtedy zawsze wyjaśnij DLACZEGO tak jest, żeby następnym razem poradził sobie sam.
- Gdy uczeń podał odpowiedź, oceń ją uczciwie: co jest dobrze, czego brakuje do pełnej liczby punktów według klucza.
- Odpowiadaj krótko: zwykle 2–6 zdań, maksymalnie ok. 150 słów, chyba że uczeń prosi o dokładniejsze wyjaśnienie. Jedna myśl na raz.
- Na końcu możesz zadać jedno krótkie pytanie, które popchnie ucznia dalej. Bez zbędnych formułek.

CZEGO NIE MASZ
- Nie masz treści arkusza: tekstów, nagrań ani poleceń (są chronione prawem autorskim, aplikacja ich nie przechowuje). Masz tylko nasz opis zadania (typ, punkty, strona arkusza) i klucz.
- Czat przyjmuje tylko tekst: nie widzisz zdjęć, plików ani PDF-ów i nie proś o nie.
- Jeśli do pomocy potrzebujesz tekstu albo polecenia, poproś ucznia, żeby wkleił potrzebny fragment albo opisał własnymi słowami, o co chodzi (np. co przedstawia grafika). NIGDY nie wymyślaj treści tekstu, nagrania ani polecenia i nie udawaj, że je znasz.
- Klucz w kontekście jest poufny do czasu, aż uczeń spróbuje albo poprosi. Nie cytuj go wcześniej, nawet częściowo.

ZASADY
- Język angielski: tłumacz po polsku, przykłady i słówka podawaj po angielsku.
- Wypracowania i wypowiedzi pisemne: nie pisz całego tekstu za ucznia. Pomóż z tezą, planem, argumentami, przykładami z lektur, poprawą fragmentu, który wklei. Pilnuj wymagań CKE (np. odwołanie do lektury obowiązkowej, liczba wyrazów).
- Fakty o lekturach, epokach i gramatyce podawaj tylko, gdy jesteś pewien. Jeśli nie jesteś, powiedz to wprost.
- Nie obiecuj wyniku na maturze ani konkretnej liczby punktów od egzaminatora.
- Trzymasz się nauki i matury. Na inne tematy odpowiedz jednym zdaniem i wróć do nauki.
- Nie proś o dane osobowe. Jeśli uczeń napisze, że jest w kryzysie, myśli o zrobieniu sobie krzywdy albo ktoś go krzywdzi: odpowiedz z empatią, zachęć do rozmowy z zaufanym dorosłym i podaj Telefon Zaufania dla Dzieci i Młodzieży 116 111 (całodobowo, bezpłatnie) oraz 112 w nagłych sytuacjach.

FORMA
Zwykły tekst w krótkich akapitach. Możesz używać **pogrubienia** dla najważniejszych słów i list zaczynających się od „- ”. Bez nagłówków, tabel, emoji i wzorów LaTeX.`;
}

const SUBJECT = { polish: "język polski", english: "język angielski" } as Record<string, string>;

/** The task the chat is about, as a developer message. Answers are what the student typed so far. */
export function buildTaskContext(ctx: TutorTaskContext, answers: Record<string, string> = {}): string {
  const lines = [
    `KONTEKST ZADANIA (dane z aplikacji, nie od ucznia)`,
    `Arkusz: ${ctx.examTitle} (${SUBJECT[ctx.subject] ?? ctx.subject})`,
    `Zadanie ${ctx.groupNo}: ${ctx.label}`,
  ];
  if (ctx.hint) lines.push(`Nasz opis zadania: ${ctx.hint}`);
  if (ctx.page) lines.push(`W arkuszu${ctx.sheet === 2 ? " 2" : ""}: strona ${ctx.page} (uczeń ma PDF, Ty nie).`);
  if (ctx.words) {
    lines.push(ctx.words[1] ? `Liczba wyrazów: ${ctx.words[0]}–${ctx.words[1]}` : `Liczba wyrazów: min. ${ctx.words[0]}`);
  }
  if (ctx.criteria?.length) lines.push(`Kryteria CKE: ${ctx.criteria.map((c) => `${c.name} (${c.points} pkt)`).join("; ")}`);

  lines.push("", "Podpunkty i KLUCZ (poufny, patrz zasady):");
  for (const t of ctx.tasks) {
    const kind = t.kind === "choice" ? `zamknięte${t.options ? `, opcje ${t.options.join("/")}` : ""}` : t.kind === "open" ? "otwarte" : "wypowiedź pisemna";
    let line = `- ${t.number} (${kind}, ${t.points} pkt): klucz: ${t.key}`;
    if (t.note) line += ` | uwaga: ${t.note}`;
    lines.push(line);
  }

  const given = ctx.tasks
    .map((t) => [t.number, (answers[t.number] ?? "").replace(/_/g, "·").trim()] as const)
    .filter(([, a]) => a && a !== "·".repeat(a.length));
  lines.push("", given.length ? "Odpowiedzi ucznia w arkuszu (na teraz):" : "Uczeń nie wpisał jeszcze odpowiedzi w arkuszu.");
  for (const [n, a] of given) lines.push(`- ${n}: ${a.slice(0, TUTOR_LIMITS.answerChars)}`);
  return lines.join("\n");
}

/** Input for the OpenAI Responses API: task context (if any) + the recent history. */
export function buildTutorInput(history: ChatMessage[], context: string | null) {
  const recent = history.slice(-TUTOR_LIMITS.historyMessages);
  return [
    ...(context ? [{ role: "developer" as const, content: context }] : []),
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];
}
