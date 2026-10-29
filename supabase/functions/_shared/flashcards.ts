import { z } from "zod";

// AI flashcards, shared by the Edge Function `flashcards-generate` (Deno) and the website (Next.js).
// Keep this file free of Node- or Deno-specific code.
//
// Where the material comes from:
//   pdf / docx / pptx: text extracted IN THE BROWSER (src/lib/flashcards/extract.ts); scanned PDFs
//                      are sent as page images instead
//   photo:             shrunk photos, read by the AI
//   url:               the Edge Function fetches the page (safely, see isSafePublicUrl) and extracts text
//   youtube:           a link: the Edge Function fetches the captions via ScrapeCreators (or the student
//                      pastes the transcript); the title comes from YouTube's public oEmbed
//   text:              pasted text

export const FLASHCARD_LIMITS = {
  textChars: 40_000,
  images: 4,
  imageChars: 1_700_000,
  minTextChars: 40,
  counts: [10, 20, 30] as const,
  /** Card text limits (also enforced by the database). */
  frontChars: 300,
  backChars: 600,
} as const;

export const AI_SOURCES = ["text", "photo", "pdf", "docx", "pptx", "url", "youtube"] as const;
export type AiSource = (typeof AI_SOURCES)[number];
export const CARD_STYLES = ["auto", "qa", "vocab"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const flashcardRequestSchema = z
  .object({
    subject: z.enum(["polish", "english", "other"]),
    kind: z.enum(AI_SOURCES),
    /** File name, page title or URL, shown on the deck. */
    label: z.string().trim().max(300).default(""),
    text: z.string().trim().max(FLASHCARD_LIMITS.textChars).default(""),
    images: z
      .array(z.string().max(FLASHCARD_LIMITS.imageChars).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/))
      .max(FLASHCARD_LIMITS.images)
      .default([]),
    url: z.string().trim().max(2000).optional(),
    count: z.union([z.literal(10), z.literal(20), z.literal(30)]).default(20),
    style: z.enum(CARD_STYLES).default("auto"),
  })
  .superRefine((r, ctx) => {
    const tooLittle = () => ctx.addIssue({ code: "custom", message: "too_little", path: ["text"] });
    if (r.kind === "url") {
      if (!r.url || !isSafePublicUrl(r.url)) ctx.addIssue({ code: "custom", message: "bad_url", path: ["url"] });
    } else if (r.kind === "youtube") {
      // The transcript is optional: without it, the Edge Function fetches the captions.
      if (!r.url || !youtubeId(r.url)) ctx.addIssue({ code: "custom", message: "bad_url", path: ["url"] });
    } else if (r.images.length === 0 && r.text.length < FLASHCARD_LIMITS.minTextChars) {
      tooLittle();
    }
  });
export type FlashcardRequest = z.input<typeof flashcardRequestSchema>;

// ─── What the AI returns ─────────────────────────────────────────────────────
export const aiCardsSchema = z.object({
  title: z.string(),
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
  warnings: z.array(z.string()),
});
export type AiCards = z.infer<typeof aiCardsSchema>;
export type Card = AiCards["cards"][number];

export function openAiCardsSchema(count: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "cards", "warnings"],
    properties: {
      title: { type: "string", description: "krótki tytuł talii, np. „Romantyzm – pojęcia”" },
      cards: {
        type: "array",
        description: `około ${count} fiszek`,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["front", "back"],
          properties: {
            front: { type: "string", description: "przód: krótkie pytanie, hasło albo słowo" },
            back: { type: "string", description: "tył: krótka odpowiedź" },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" }, description: "np. nieczytelny fragment; pusta lista, gdy OK" },
    },
  };
}

const STYLE_HINT: Record<CardStyle, string> = {
  auto: "Sam wybierz: słówka, gdy materiał to słownictwo; w innym wypadku pytania i odpowiedzi.",
  qa: "Pytania i odpowiedzi: przód to konkretne pytanie, tył to krótka odpowiedź.",
  vocab:
    "Słówka: przód to słowo lub zwrot (w języku obcym, jeśli materiał jest obcojęzyczny), tył to znaczenie po polsku i krótki przykład użycia.",
};

const SUBJECT_HINT: Record<string, string> = {
  polish: "Przedmiot: język polski (matura): epoki, lektury, bohaterowie, motywy, pojęcia, środki stylistyczne.",
  english: "Przedmiot: język angielski (matura). Słówka i zwroty po angielsku, znaczenia i wyjaśnienia po polsku.",
  other: "Przedmiot: inny.",
};

/** System prompt. Depends only on the subject and style, so OpenAI can cache it. */
export function buildCardsInstructions(subject: string, style: CardStyle): string {
  return `Robisz fiszki do nauki w aplikacji „Ogarnij Maturę” z materiału, który przysłał uczeń (tekst z PDF-a, Worda, prezentacji, strony internetowej, transkrypcji filmu albo zdjęcia notatek).
${SUBJECT_HINT[subject] ?? SUBJECT_HINT.other}
Rodzaj fiszek: ${STYLE_HINT[style]}

ZASADY DOBRYCH FISZEK
- Jedna fiszka = jedna rzecz do zapamiętania. Nie upychaj kilku faktów na jednej fiszce.
- Przód krótki i jednoznaczny (najlepiej do 15 słów), tył krótki (najlepiej do 25 słów). Bez „Prawda czy fałsz”.
- Wybieraj to, co najważniejsze do matury: pojęcia, fakty, daty, autorów, bohaterów, związki przyczynowe, słówka. Pomijaj ozdobniki, reklamy, menu strony, przypisy.
- Opieraj się wyłącznie na materiale. Nie wymyślaj faktów, dat ani cytatów. Jeśli w materiale jest oczywisty błąd, nie rób z niego fiszki i dodaj ostrzeżenie do "warnings".
- Bez powtórzeń: każda fiszka pyta o coś innego.
- Pisz po polsku (poza słówkami i przykładami w języku obcym). Bez Markdown i emoji.
- Jeśli materiał nie nadaje się do nauki (np. pusty, przypadkowe zdjęcie), zwróć pustą listę "cards" i wyjaśnij to w "warnings".
- Na zdjęciach pomijaj dane osobowe (imiona i nazwiska uczniów, telefony, adresy).`;
}

const SOURCE_LABEL: Record<AiSource, string> = {
  text: "wklejony tekst",
  photo: "zdjęcia notatek",
  pdf: "PDF",
  docx: "dokument Word",
  pptx: "prezentacja PowerPoint",
  url: "strona internetowa",
  youtube: "transkrypcja filmu z YouTube",
};

/** Input for the OpenAI Responses API. */
export function buildCardsInput(r: { kind: AiSource; label: string; text: string; images: string[]; count: number }) {
  const head = `Źródło: ${SOURCE_LABEL[r.kind]}${r.label ? ` („${r.label}”)` : ""}. Zrób około ${r.count} fiszek.`;
  const parts: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" })[] = [
    { type: "input_text", text: r.text ? `${head}\n\nMATERIAŁ:\n${r.text}` : head },
  ];
  for (const url of r.images) parts.push({ type: "input_image", image_url: url, detail: "high" });
  return [{ role: "user" as const, content: parts }];
}

// ─── Our rules, applied after the AI ─────────────────────────────────────────
const clean = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

export class NoCardsError extends Error {}

/** Trims, drops empty and duplicate cards, caps the number. */
export function normalizeCards(ai: AiCards, max: number): { title: string; cards: Card[]; warnings: string[] } {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const c of ai.cards) {
    const front = clean(c.front, FLASHCARD_LIMITS.frontChars);
    const back = clean(c.back, FLASHCARD_LIMITS.backChars);
    const key = front.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (!front || !back || !key || seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back });
    if (cards.length >= max) break;
  }
  if (cards.length === 0) throw new NoCardsError(ai.warnings.join(" ") || "no cards");
  return {
    title: clean(ai.title, 120) || "Fiszki",
    cards,
    warnings: ai.warnings.map((w) => clean(w, 300)).filter(Boolean).slice(0, 3),
  };
}

// ─── Quizlet / Anki / CSV import (no AI) ─────────────────────────────────────
/**
 * One card per line, front and back separated by a tab (Quizlet and Anki export), " - ",
 * ";" or ",". Returns the cards it understood.
 */
export function parseImport(text: string): Card[] {
  const cards: Card[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const sep = ["\t", " - ", " – ", ";", ","].find((s) => line.includes(s));
    if (!sep) continue;
    const i = line.indexOf(sep);
    const front = clean(line.slice(0, i).replace(/^"|"$/g, ""), FLASHCARD_LIMITS.frontChars);
    const back = clean(line.slice(i + sep.length).replace(/^"|"$/g, ""), FLASHCARD_LIMITS.backChars);
    if (front && back) cards.push({ front, back });
    if (cards.length >= 1000) break;
  }
  return cards;
}

// ─── Websites ────────────────────────────────────────────────────────────────
/** Private, loopback, link-local and other non-public IPv4 ranges. */
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

export function isPrivateAddress(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h.includes(":")) {
    // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10), IPv4-mapped
    return h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith("::ffff:");
  }
  return isPrivateIPv4(h);
}

/**
 * Only public http(s) pages: no credentials in the URL, no unusual ports, no localhost or
 * private/internal addresses (so nobody can make our server fetch internal services).
 */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") && !host.includes(":")) return false; // "localhost", "intranet"
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return false;
  return !isPrivateAddress(host);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", bdquo: "„", rdquo: "”", ldquo: "“", oacute: "ó" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Readable text of a web page: the article (or main content), without menus, scripts and ads. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ");
  const pick = (tag: string) => body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}>`, "i"))?.[1];
  body = pick("article") ?? pick("main") ?? pick("body") ?? body;
  body = body.replace(/<(nav|header|footer|aside|form|button|figure)\b[\s\S]*?<\/\1>/gi, " ");
  const text = decodeEntities(
    body
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/blockquote)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title, text };
}

// ─── YouTube ─────────────────────────────────────────────────────────────────
/** The video id from a youtube.com / youtu.be link, or null. */
export function youtubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
