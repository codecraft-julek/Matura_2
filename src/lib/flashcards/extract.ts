// Reads text from files IN THE BROWSER, so documents never leave the student's device as files:
// only the extracted text (or, for scanned PDFs, a few page images) goes to the AI.
//   PDF:  pdf.js (text layer); a scanned PDF without text → the first pages as images
//   DOCX: a ZIP with word/document.xml → paragraphs
//   PPTX: a ZIP with ppt/slides/slideN.xml → text per slide

import { FLASHCARD_LIMITS } from "@shared/flashcards";
// Vite: `?url` emits the worker as an asset and gives its URL (pdf.js itself still loads lazily).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type FileKind = "pdf" | "docx" | "pptx";
export type Extracted = { kind: FileKind; label: string; text: string; images: string[]; info: string };

const MAX_FILE_MB = 25;
const SCANNED_PAGES = 4;

export function fileKind(file: File): FileKind | "old-office" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".doc") || name.endsWith(".ppt")) return "old-office";
  return null;
}

export async function extractFile(file: File): Promise<Extracted> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Ten plik jest za duży (maks. ${MAX_FILE_MB} MB).`);
  const kind = fileKind(file);
  if (kind === "old-office") {
    throw new Error("To stary format (.doc / .ppt). Otwórz plik i zapisz go jako .docx albo .pptx, a potem wgraj ponownie.");
  }
  if (!kind) throw new Error("Obsługujemy pliki PDF, Word (.docx) i PowerPoint (.pptx).");
  const data = new Uint8Array(await file.arrayBuffer());
  const label = file.name.replace(/\.[^.]+$/, "").slice(0, 200);
  try {
    if (kind === "pdf") return { kind, label, ...(await readPdf(data)) };
    if (kind === "docx") return { kind, label, ...(await readDocx(data)) };
    return { kind, label, ...(await readPptx(data)) };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("!")) throw new Error(err.message.slice(1));
    console.error("extractFile failed:", err);
    throw new Error("Nie udało się odczytać tego pliku. Może jest uszkodzony albo zabezpieczony hasłem?");
  }
}

/** Polish plural: plural(1, "strona", "strony", "stron") → "1 strona", 3 → "3 strony", 5 → "5 stron". */
function plural(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const dd = n % 100;
  const word = n === 1 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
  return `${n} ${word}`;
}

const cap = (text: string) => {
  const clean = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > FLASHCARD_LIMITS.textChars ? clean.slice(0, FLASHCARD_LIMITS.textChars) : clean;
};

// ─── PDF ─────────────────────────────────────────────────────────────────────
async function readPdf(data: Uint8Array): Promise<Omit<Extracted, "kind" | "label">> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const doc = await pdfjs.getDocument({ data }).promise;

  let text = "";
  let pagesRead = 0;
  for (let p = 1; p <= doc.numPages && text.length < FLASHCARD_LIMITS.textChars; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
    }
    text += "\n\n";
    pagesRead = p;
  }

  // A scan (photos of pages) has no text layer: send the first pages as images instead.
  if (text.replace(/\s/g, "").length < 200) {
    const images: string[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, SCANNED_PAGES); p++) {
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, 1600 / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(toJpeg(canvas));
    }
    const more = doc.numPages > SCANNED_PAGES ? ` (pierwsze z ${doc.numPages})` : "";
    return { text: "", images, info: `Skan bez tekstu: AI przeczyta ${plural(images.length, "stronę", "strony", "stron")}${more}.` };
  }

  const info =
    pagesRead < doc.numPages
      ? `Odczytano tekst. AI dostanie pierwsze ${pagesRead} z ${doc.numPages} stron.`
      : `Odczytano tekst: ${plural(doc.numPages, "strona", "strony", "stron")}.`;
  return { text: cap(text), images: [], info };
}

function toJpeg(canvas: HTMLCanvasElement): string {
  for (const q of [0.8, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= FLASHCARD_LIMITS.imageChars) return url;
  }
  throw new Error("!Strony tego skanu są za duże. Zrób zdjęcia stron i wgraj je w zakładce „Zdjęcia”.");
}

// ─── Word / PowerPoint (ZIP + XML) ───────────────────────────────────────────
async function unzip(data: Uint8Array, wanted: (name: string) => boolean): Promise<Record<string, string>> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(data, { filter: (f) => wanted(f.name) });
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, strFromU8(bytes)]));
}

/** Text of every paragraph (`<w:p>` / `<a:p>`), keeping tabs and line breaks. */
function paragraphs(xml: string, p: string, t: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const out: string[] = [];
  for (const para of Array.from(doc.getElementsByTagName(p))) {
    let line = "";
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (child.tagName === t) line += child.textContent ?? "";
        else if (child.tagName.endsWith(":tab")) line += "\t";
        else if (child.tagName.endsWith(":br")) line += "\n";
        else walk(child);
      }
    };
    walk(para);
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

async function readDocx(data: Uint8Array): Promise<Omit<Extracted, "kind" | "label">> {
  const files = await unzip(data, (n) => n === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("!To nie wygląda na plik Worda (.docx).");
  const text = paragraphs(xml, "w:p", "w:t").join("\n");
  if (!text.trim()) throw new Error("!W tym dokumencie nie ma tekstu (może są w nim tylko obrazki?).");
  return { text: cap(text), images: [], info: `Odczytano tekst: ${plural(text.length, "znak", "znaki", "znaków")}.` };
}

async function readPptx(data: Uint8Array): Promise<Omit<Extracted, "kind" | "label">> {
  const files = await unzip(data, (n) => /^ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/.test(n));
  const num = (n: string) => Number(n.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(files)
    .filter((n) => n.startsWith("ppt/slides/"))
    .sort((a, b) => num(a) - num(b));
  if (slides.length === 0) throw new Error("!To nie wygląda na prezentację PowerPoint (.pptx).");

  const parts = slides.map((name) => {
    const body = paragraphs(files[name], "a:p", "a:t").join("\n");
    // Speaker notes often hold the real explanation.
    const notesXml = files[`ppt/notesSlides/notesSlide${num(name)}.xml`];
    const notes = notesXml ? paragraphs(notesXml, "a:p", "a:t").filter((l) => !/^\d+$/.test(l)).join("\n") : "";
    return [`Slajd ${num(name)}:`, body, notes && `Notatki prelegenta: ${notes}`].filter(Boolean).join("\n");
  });
  const text = parts.join("\n\n");
  if (text.replace(/Slajd \d+:/g, "").trim().length < 40) throw new Error("!Na tych slajdach prawie nie ma tekstu.");
  return { text: cap(text), images: [], info: `Odczytano ${plural(slides.length, "slajd", "slajdy", "slajdów")}.` };
}
