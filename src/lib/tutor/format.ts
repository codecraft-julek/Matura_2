// Turns the tutor's reply into simple blocks: paragraphs, bullet lists, numbered lists, with **bold**,
// and diagrams (```diagram fences with JSON, validated by tutorDiagramSchema). We render these as
// Vue elements (never as HTML), so AI output can't inject markup.

import { TUTOR_DIAGRAMS_PER_REPLY, tutorDiagramSchema, type TutorDiagram } from "@shared/tutor";

export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "diagram"; diagram: TutorDiagram }
  /** A diagram that is still streaming in: shown as "drawing…" instead of half a JSON. */
  | { type: "pending" };

/** "a **b** c" → [{a}, {b, bold}, {c}]. An unclosed "**" (mid-stream) is shown as plain text. */
export function parseInline(line: string): Inline[] {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((p) => p.text.length > 0);
}

function parseParagraphs(text: string, blocks: Block[]) {
  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    let current: Block | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      const bullet = line.match(/^[-•*]\s+(.*)$/);
      const numbered = line.match(/^\d+[.)]\s+(.*)$/);
      const type = bullet ? "ul" : numbered ? "ol" : "p";
      const content = parseInline(bullet?.[1] ?? numbered?.[1] ?? line.replace(/^#+\s*/, ""));
      if (!current || current.type !== type) {
        current = type === "p" ? { type, lines: [] } : { type, items: [] };
        blocks.push(current);
      }
      if (current.type === "p") current.lines.push(content);
      else if (current.type === "ul" || current.type === "ol") current.items.push(content);
    }
  }
}

// ```diagram, the JSON, then ``` (or the end of the text while it's still streaming).
const FENCE = /```diagram[^\n]*\n?([\s\S]*?)(```|$)/g;

/** The diagram in a fence, or null when it isn't valid. */
export function parseDiagram(json: string): TutorDiagram | null {
  try {
    const parsed = tutorDiagramSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseTutorText(text: string): Block[] {
  const blocks: Block[] = [];
  const source = text.replace(/\r\n/g, "\n");
  let at = 0;
  let diagrams = 0;
  for (const m of source.matchAll(FENCE)) {
    const start = m.index ?? 0;
    parseParagraphs(source.slice(at, start), blocks);
    at = start + m[0].length;
    if (!m[2]) {
      blocks.push({ type: "pending" });
      continue;
    }
    const diagram = parseDiagram(m[1].trim());
    if (diagram && diagrams < TUTOR_DIAGRAMS_PER_REPLY) {
      blocks.push({ type: "diagram", diagram });
      diagrams += 1;
    }
  }
  parseParagraphs(source.slice(at), blocks);
  return blocks;
}

/** The reply without diagram code, for screen reader announcements and plain-text uses. */
export function plainTutorText(text: string): string {
  return text.replace(FENCE, "").replace(/\n{3,}/g, "\n\n").trim();
}
