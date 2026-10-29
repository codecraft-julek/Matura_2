// Turns the tutor's reply into simple blocks: paragraphs, bullet lists, numbered lists, with **bold**.
// We render these as React elements (never as HTML), so AI output can't inject markup.

export type Inline = { text: string; bold: boolean };
export type Block = { type: "p"; lines: Inline[][] } | { type: "ul" | "ol"; items: Inline[][] };

/** "a **b** c" → [{a}, {b, bold}, {c}]. An unclosed "**" (mid-stream) is shown as plain text. */
export function parseInline(line: string): Inline[] {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((p) => p.text.length > 0);
}

export function parseTutorText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
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
      else current.items.push(content);
    }
  }
  return blocks;
}
