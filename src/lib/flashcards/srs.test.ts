import { describe, expect, it } from "vitest";
import { formatInterval, nextReview, type SrsState } from "./srs";

const now = new Date("2026-10-20T10:00:00Z");
const fresh: SrsState = { interval_days: 0, ease: 2.5, reps: 0, lapses: 0 };

describe("nextReview", () => {
  it("schedules a new card: again 10 min, hard/good 1 day, easy 3 days", () => {
    expect(formatInterval(nextReview(fresh, 0, now), now)).toBe("10 min");
    expect(formatInterval(nextReview(fresh, 1, now), now)).toBe("1 dzień");
    expect(formatInterval(nextReview(fresh, 2, now), now)).toBe("1 dzień");
    expect(formatInterval(nextReview(fresh, 3, now), now)).toBe("3 dni");
  });

  it("grows the interval with every good answer", () => {
    let card: SrsState = fresh;
    const days: number[] = [];
    for (let i = 0; i < 4; i++) {
      card = nextReview(card, 2, now);
      days.push(card.interval_days);
    }
    expect(days).toEqual([1, 3, 7.5, 18.75]);
  });

  it("a forgotten card starts over and gets harder, but ease never drops below 1.3", () => {
    let card: SrsState = { interval_days: 20, ease: 1.4, reps: 5, lapses: 0 };
    card = nextReview(card, 0, now);
    expect(card).toMatchObject({ interval_days: 0, reps: 0, lapses: 1, ease: 1.3 });
  });

  it("never schedules more than a year ahead", () => {
    expect(nextReview({ interval_days: 300, ease: 3.5, reps: 9, lapses: 0 }, 3, now).interval_days).toBe(365);
  });
});
