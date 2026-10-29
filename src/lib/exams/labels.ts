// Polish labels for exam data. Used in client and server components.

export const SUBJECT_LABEL: Record<string, string> = {
  polish: "Język polski",
  english: "Język angielski",
};

export const LEVEL_LABEL: Record<string, string> = {
  basic: "podstawowy",
  extended: "rozszerzony",
};

export const SESSION_LABEL: Record<string, string> = {
  main: "maj",
  june: "czerwiec",
  august: "sierpień",
  sample: "próbny",
};

export const SECTION_LABEL: Record<string, string> = {
  listening: "Rozumienie ze słuchu",
  reading: "Rozumienie tekstów pisanych",
  language: "Znajomość środków językowych",
  writing: "Wypowiedź pisemna",
  test: "Arkusz 1 · test",
};

export type ResultStatus =
  | "correct"
  | "incorrect"
  | "empty"
  | "unchecked"
  | "self_correct"
  | "self_partial"
  | "partial"
  | "self_incorrect"
  | "ai_graded"
  | "writing";

export type TaskResult = {
  status: ResultStatus;
  points: number;
  max: number;
  answer: string;
  note: string | null;
  /** Set when AI graded this open answer (the student may still override the points). */
  ai_points?: number;
  ai_reason?: string;
  ai_uncertain?: boolean;
};

/** Open answers the student compares with the key (or lets AI grade). */
export const REVIEW_STATUSES: ResultStatus[] = ["unchecked", "self_correct", "self_incorrect", "self_partial", "ai_graded"];

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** "2 pkt", "1 pkt", "5 pkt" — Polish uses "pkt" for every number, which keeps this simple. */
export const pts = (n: number) => `${n} pkt`;
