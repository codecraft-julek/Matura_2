// How much of an AI feature the student has left (from my_ai_allowance(), limits per plan).
// Shared by server pages and client forms, so no server-only imports here.

export type AiFeature = "essay_feedback" | "tutor" | "open_grading" | "notes" | "flashcards";

export type Allowance = {
  plan: "free" | "premium";
  max: number;
  period: "day" | "week";
  used: number;
  left: number;
};

/** "Dziś zostało:" / "W tym tygodniu zostało:" (the number goes after it). */
export const leftLabel = (a: Allowance) => (a.period === "week" ? "W tym tygodniu zostało:" : "Dziś zostało:");

/** Shown instead of the button when the limit is used up. */
export const limitReachedText = (a: Allowance) =>
  a.period === "week" ? "Limit na ten tydzień wykorzystany, nowy od poniedziałku." : "Dzisiejszy limit wykorzystany, wróć jutro.";
