// 👍/👎 on AI answers (table ai_ratings). Shared by the server action, queries and the AiRating button.

export const RATING_KINDS = ["essay", "note", "deck", "tutor_message", "open_grading"] as const;
export type RatingKind = (typeof RATING_KINDS)[number];

/** The student's rating of one AI answer: 1 = 👍, -1 = 👎, plus an optional comment on 👎. */
export type Rating = { rating: 1 | -1; comment: string };
