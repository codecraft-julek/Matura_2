import { describe, expect, it } from "vitest";
import { parseInline, parseTutorText, plainTutorText } from "./format";

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

describe("diagrams in a reply", () => {
  const process = '{"type":"process","heading":"Cykl Calvina","steps":["Karboksylacja: wiązanie CO2","Redukcja: powstaje aldehyd","Regeneracja RuBP"],"cycle":true}';
  const fence = (json: string) => "```diagram\n" + json + "\n```";

  it("turns a valid fence into a diagram between the paragraphs", () => {
    const blocks = parseTutorText(`Tak wygląda cykl:\n\n${fence(process)}\n\nZapamiętaj trzy etapy.`);
    expect(blocks.map((b) => b.type)).toEqual(["p", "diagram", "p"]);
    expect(blocks[1]).toMatchObject({ type: "diagram", diagram: { type: "process", cycle: true, steps: ["Karboksylacja: wiązanie CO2", "Redukcja: powstaje aldehyd", "Regeneracja RuBP"] } });
  });

  it("shows a fence that is still streaming as pending, not as JSON", () => {
    const blocks = parseTutorText('Zobacz:\n```diagram\n{"type":"process","steps":["A",');
    expect(blocks.map((b) => b.type)).toEqual(["p", "pending"]);
  });

  it("drops a diagram that is not valid JSON or not in the menu", () => {
    expect(parseTutorText(fence("{nie json}")).map((b) => b.type)).toEqual([]);
    expect(parseTutorText(fence('{"type":"html","body":"<script>alert(1)</script>"}'))).toEqual([]);
    expect(parseTutorText(fence('{"type":"process","steps":["tylko jeden"]}'))).toEqual([]);
  });

  it("gives every table row one value per column (a Punnett square)", () => {
    const punnett = '{"type":"compare","heading":"Aa × Aa","columns":["A","a"],"rows":[{"feature":"A","values":["AA","Aa"]},{"feature":"a","values":["Aa"]}]}';
    const [block] = parseTutorText(fence(punnett));
    expect(block).toMatchObject({ type: "diagram", diagram: { rows: [{ values: ["AA", "Aa"] }, { values: ["Aa", "–"] }] } });
  });

  it("shows at most two diagrams per reply", () => {
    const blocks = parseTutorText([fence(process), fence(process), fence(process)].join("\n\n"));
    expect(blocks.filter((b) => b.type === "diagram")).toHaveLength(2);
  });

  it("leaves the diagram code out of the plain text", () => {
    expect(plainTutorText(`Przed\n\n${fence(process)}\n\nPo`)).toBe("Przed\n\nPo");
  });
});
