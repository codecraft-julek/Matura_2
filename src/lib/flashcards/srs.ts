// Spaced repetition (a simple version of SM-2, the algorithm behind Anki):
// every answer moves the card's next review further away the better you know it.
//   "Nie umiem" → again in 10 minutes, the card gets a bit harder (ease − 0.2)
//   "Umiem"     → 1 day, then 3 days, then interval × ease

export type SrsState = { interval_days: number; ease: number; reps: number; lapses: number };
export type SrsNext = SrsState & { due_at: Date };

const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const AGAIN_MINUTES = 10;
const DAY = 24 * 60 * 60 * 1000;

const round = (n: number) => Math.round(n * 100) / 100;
const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, round(e)));

export function nextReview(card: SrsState, knew: boolean, now = new Date()): SrsNext {
  const ease = Number(card.ease) || 2.5;
  const interval = Number(card.interval_days) || 0;

  if (!knew) {
    return {
      interval_days: 0,
      ease: clampEase(ease - 0.2),
      reps: 0,
      lapses: card.lapses + 1,
      due_at: new Date(now.getTime() + AGAIN_MINUTES * 60 * 1000),
    };
  }

  const days = Math.min(round(card.reps === 0 ? 1 : card.reps === 1 ? 3 : interval * ease), 365); // never more than a year away (matura comes first)
  return {
    interval_days: days,
    ease: clampEase(ease),
    reps: card.reps + 1,
    lapses: card.lapses,
    due_at: new Date(now.getTime() + days * DAY),
  };
}

type CardProgress = Pick<SrsState, "reps" | "lapses">;

/** "Trudna": forgotten, and not yet answered "Umiem" twice in a row since. Never also "umiesz". */
export const isHardCard = (c: CardProgress) => c.lapses > 0 && c.reps < 2;
/** "Umiesz": the last answer was "Umiem", and the card isn't still hard. */
export const isLearnedCard = (c: CardProgress) => c.reps > 0 && !isHardCard(c);
