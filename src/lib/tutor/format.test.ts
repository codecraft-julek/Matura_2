import { describe, expect, it } from "vitest";
import { parseInline, parseTutorText } from "./format";

describe("parseInline", () => {
  it("finds bold parts", () => {
    expect(parseInline("to **ważne** słowo")).toEqual([
      { text: "to ", bold: false },
      { text: "ważne", bold: true },
      { text: " słowo", bold: false },
    ]);
  });

  it("keeps an unfinished ** as text while streaming", () => {
    expect(parseInline("to **waż")).toEqual([{ text: "to **waż", bold: false }]);
  });

  it("never produces HTML", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ text: "<img src=x onerror=alert(1)>", bold: false }]);
  });
});

describe("parseTutorText", () => {
  it("splits paragraphs and lists", () => {
    const blocks = parseTutorText("Cześć!\n\n- jeden\n- **dwa**\n\n1. A\n2) B\nKoniec");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol", "p"]);
    expect(blocks[1]).toEqual({
      type: "ul",
      items: [[{ text: "jeden", bold: false }], [{ text: "dwa", bold: true }]],
    });
  });

  it("drops markdown heading marks", () => {
    expect(parseTutorText("## Plan")).toEqual([{ type: "p", lines: [[{ text: "Plan", bold: false }]] }]);
  });
});
