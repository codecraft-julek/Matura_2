// Shrinks a photo in the browser before sending: max 1600 px on the long side, JPEG. A phone photo
// (4–12 MB) becomes ~200–600 KB, which is plenty for the AI to read handwriting and keeps uploads fast.
// Re-encoding also drops EXIF data (e.g. GPS location).

import { NOTE_LIMITS } from "@shared/notes";

const MAX_SIDE = 1600;

export async function shrinkPhoto(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Nie udało się wczytać zdjęcia. Spróbuj zdjęcia w formacie JPG albo PNG.");
  }

  for (const [side, quality] of [
    [MAX_SIDE, 0.82],
    [MAX_SIDE, 0.7],
    [1280, 0.7],
  ] as const) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#fff"; // transparent PNGs → white page, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= NOTE_LIMITS.imageChars) {
      bitmap.close();
      return url;
    }
  }
  bitmap.close();
  throw new Error("To zdjęcie jest za duże. Spróbuj zrobić je jeszcze raz albo przyciąć.");
}
