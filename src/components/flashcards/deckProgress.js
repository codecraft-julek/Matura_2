// Progress of a generated deck, from the streamed character count and the seconds so far.
// A card is about this many characters of JSON.
const CHARS_PER_CARD = 120

/** 0..1. Before the first text arrives it creeps up with time, so it never looks stuck. */
export function deckProgress({ chars, seconds, count }) {
  return chars ? 0.15 + 0.83 * Math.min(chars / (count * CHARS_PER_CARD), 1) : Math.min(seconds / 40, 0.15)
}

export const cardsDoneText = (chars, count) => `Gotowe mniej więcej ${Math.min(count, Math.round(chars / CHARS_PER_CARD))} z ${count} fiszek…`
