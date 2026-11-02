import { describe, expect, it } from "vitest";
import { isHardCard, isLearnedCard, nextReview, type SrsState } from "./srs";

const now = new Date("2026-10-20T10:00:00Z");
const fresh: SrsState = { interval_days: 0, ease: 2.5, reps: 0, lapses: 0 };

describe("nextReview", () => {
  it("schedules a new card: not known 10 min, known 1 day", () => {
    expect(nextReview(fresh, false, now).due_at).toEqual(new Date("2026-10-20T10:10:00Z"));
    expect(nextReview(fresh, true, now).due_at).toEqual(new Date("2026-10-21T10:00:00Z"));
  });

  it("grows the interval with every known answer", () => {
    let card: SrsState = fresh;
    const days: number[] = [];
    for (let i = 0; i < 4; i++) {
      card = nextReview(card, true, now);
      days.push(card.interval_days);
    }
    expect(days).toEqual([1, 3, 7.5, 18.75]);
  });

  it("a forgotten card starts over and gets harder, but ease never drops below 1.3", () => {
    let card: SrsState = { interval_days: 20, ease: 1.4, reps: 5, lapses: 0 };
    card = nextReview(card, false, now);
    expect(card).toMatchObject({ interval_days: 0, reps: 0, lapses: 1, ease: 1.3 });
  });

  it("never schedules more than a year ahead", () => {
    expect(nextReview({ interval_days: 300, ease: 3.5, reps: 9, lapses: 0 }, true, now).interval_days).toBe(365);
  });
});

describe("hard and learned cards", () => {
  it("a new card is neither", () => {
    expect(isHardCard(fresh)).toBe(false);
    expect(isLearnedCard(fresh)).toBe(false);
  });

  it("known at once: learned", () => {
    const card = nextReview(fresh, true, now);
    expect(isLearnedCard(card)).toBe(true);
    expect(isHardCard(card)).toBe(false);
  });

  it("forgotten: hard until answered 'Umiem' twice in a row, then learned", () => {
    let card = nextReview(fresh, false, now);
    expect(isHardCard(card)).toBe(true);
    card = nextReview(card, true, now);
    expect(isHardCard(card)).toBe(true);
    expect(isLearnedCard(card)).toBe(false);
    card = nextReview(card, true, now);
    expect(isHardCard(card)).toBe(false);
    expect(isLearnedCard(card)).toBe(true);
  });

  it("a card is never counted in both, so the two numbers can't exceed the deck", () => {
    for (let reps = 0; reps < 5; reps++) {
      for (let lapses = 0; lapses < 3; lapses++) {
        expect(isHardCard({ reps, lapses }) && isLearnedCard({ reps, lapses })).toBe(false);
      }
    }
  });
});
