// Spaced repetition (a simple version of SM-2, the algorithm behind Anki):
// every answer moves the card's next review further away the better you know it.
//   0 "Nie wiem"  → again in 10 minutes, the card gets a bit harder (ease − 0.2)
//   1 "Trudne"    → a short step (×1.2), ease − 0.15
//   2 "Dobrze"    → 1 day, then 3 days, then interval × ease
//   3 "Łatwe"     → longer than "Dobrze" (× 1.3), ease + 0.15

export type Grade = 0 | 1 | 2 | 3;
export type SrsState = { interval_days: number; ease: number; reps: number; lapses: number };
export type SrsNext = SrsState & { due_at: Date };

const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const AGAIN_MINUTES = 10;
const DAY = 24 * 60 * 60 * 1000;

const round = (n: number) => Math.round(n * 100) / 100;
const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, round(e)));

export function nextReview(card: SrsState, grade: Grade, now = new Date()): SrsNext {
  const ease = Number(card.ease) || 2.5;
  const interval = Number(card.interval_days) || 0;

  if (grade === 0) {
    return {
      interval_days: 0,
      ease: clampEase(ease - 0.2),
      reps: 0,
      lapses: card.lapses + 1,
      due_at: new Date(now.getTime() + AGAIN_MINUTES * 60 * 1000),
    };
  }

  let days: number;
  let nextEase = ease;
  if (grade === 1) {
    days = card.reps === 0 ? 1 : Math.max(1, interval * 1.2);
    nextEase = ease - 0.15;
  } else if (grade === 2) {
    days = card.reps === 0 ? 1 : card.reps === 1 ? 3 : interval * ease;
  } else {
    days = card.reps === 0 ? 3 : Math.max(4, interval * ease * 1.3);
    nextEase = ease + 0.15;
  }
  days = Math.min(round(days), 365); // never more than a year away (matura comes first)
  return {
    interval_days: days,
    ease: clampEase(nextEase),
    reps: card.reps + 1,
    lapses: card.lapses,
    due_at: new Date(now.getTime() + days * DAY),
  };
}

/** "10 min", "1 dzień", "3 dni", "2 mies." — shown under the answer buttons. */
export function formatInterval(next: SrsNext, now = new Date()): string {
  const ms = next.due_at.getTime() - now.getTime();
  if (ms < DAY) return `${Math.max(1, Math.round(ms / 60000))} min`;
  const days = Math.round(ms / DAY);
  if (days === 1) return "1 dzień";
  if (days < 31) return `${days} dni`;
  return `${Math.round(days / 30)} mies.`;
}
