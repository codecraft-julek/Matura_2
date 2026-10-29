import { describe, expect, it } from "vitest";
import {
  NoCardsError,
  buildCardsInput,
  buildCardsInstructions,
  flashcardRequestSchema,
  htmlToText,
  isSafePublicUrl,
  normalizeCards,
  parseImport,
  youtubeId,
} from "./flashcards";

const text = "Romantyzm to epoka uczuć, wyobraźni i walki o wolność narodu.";

describe("flashcardRequestSchema", () => {
  it("accepts each source with what it needs", () => {
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "pdf", text }).success).toBe(true);
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "photo", images: ["data:image/jpeg;base64,/9j/"] }).success).toBe(true);
    expect(flashcardRequestSchema.safeParse({ subject: "other", kind: "url", url: "https://pl.wikipedia.org/wiki/Romantyzm" }).success).toBe(true);
    expect(
      flashcardRequestSchema.safeParse({ subject: "english", kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", text }).success,
    ).toBe(true);
    // a link alone is enough: the transcript is fetched on the server
    expect(flashcardRequestSchema.safeParse({ subject: "english", kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" }).success).toBe(true);
  });

  it("rejects missing material, bad links and odd counts", () => {
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "text", text: "za mało" }).success).toBe(false);
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "url", url: "http://localhost:3000" }).success).toBe(false);
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "youtube", url: "https://youtu.be/123" }).success).toBe(false);
    expect(flashcardRequestSchema.safeParse({ subject: "polish", kind: "text", text, count: 1000 }).success).toBe(false);
  });
});

describe("isSafePublicUrl", () => {
  it("allows public pages", () => {
    expect(isSafePublicUrl("https://pl.wikipedia.org/wiki/Lalka_(powieść)")).toBe(true);
    expect(isSafePublicUrl("http://example.com/a?b=1")).toBe(true);
  });

  it("blocks internal addresses and tricks", () => {
    for (const url of [
      "http://localhost",
      "http://127.0.0.1",
      "http://10.0.0.5/admin",
      "http://192.168.1.1",
      "http://172.20.0.1",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://user:pass@example.com",
      "http://example.com:8080",
      "ftp://example.com",
      "file:///etc/passwd",
      "http://intranet",
      "http://db.internal",
    ]) {
      expect(isSafePublicUrl(url), url).toBe(false);
    }
  });
});

describe("htmlToText", () => {
  it("keeps the article and drops scripts, menus and footers", () => {
    const html = `<html><head><title>Lalka &ndash; streszczenie</title><script>alert(1)</script></head>
      <body><nav>Menu Główna Kontakt</nav><article><h1>Lalka</h1><p>Powieść Bolesława Prusa &amp; jej bohaterowie.</p>
      <ul><li>Wokulski</li><li>Izabela</li></ul></article><footer>© 2026</footer></body></html>`;
    const { title, text } = htmlToText(html);
    expect(title).toBe("Lalka – streszczenie");
    expect(text).toContain("Powieść Bolesława Prusa & jej bohaterowie.");
    expect(text).toContain("- Wokulski");
    expect(text).not.toMatch(/alert|Menu|©/);
  });
});

describe("youtubeId", () => {
  it("reads common link formats", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
  });
});

describe("normalizeCards", () => {
  it("drops empty and duplicate cards and caps the number", () => {
    const r = normalizeCards(
      {
        title: " Romantyzm ",
        cards: [
          { front: "Co to mesjanizm?", back: "Polska jako Chrystus narodów" },
          { front: "co to   mesjanizm", back: "duplikat" },
          { front: "", back: "pusta" },
          { front: "Kto napisał „Kordiana”?", back: "Juliusz Słowacki" },
          { front: "Trzecia", back: "ponad limit" },
        ],
        warnings: [],
      },
      2,
    );
    expect(r.title).toBe("Romantyzm");
    expect(r.cards.map((c) => c.back)).toEqual(["Polska jako Chrystus narodów", "Juliusz Słowacki"]);
  });

  it("refuses material without cards", () => {
    expect(() => normalizeCards({ title: "", cards: [], warnings: ["Pusty plik"] }, 20)).toThrow(NoCardsError);
  });
});

describe("parseImport", () => {
  it("reads Quizlet/Anki (tab), dash, semicolon and comma lines", () => {
    expect(parseImport("apple\tjabłko\nto give up - poddać się\nkot;cat\n\nbez separatora\n\"dog\",\"pies\"")).toEqual([
      { front: "apple", back: "jabłko" },
      { front: "to give up", back: "poddać się" },
      { front: "kot", back: "cat" },
      { front: "dog", back: "pies" },
    ]);
  });
});

describe("prompt", () => {
  it("is cacheable and sends the material", () => {
    expect(buildCardsInstructions("english", "vocab")).toBe(buildCardsInstructions("english", "vocab"));
    const input = buildCardsInput({ kind: "pdf", label: "romantyzm.pdf", text, images: [], count: 20 });
    expect(input[0].content[0]).toMatchObject({ type: "input_text" });
    expect((input[0].content[0] as { text: string }).text).toContain("romantyzm.pdf");
  });
});
