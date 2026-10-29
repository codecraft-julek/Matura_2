import { describe, expect, it } from "vitest";
import { waitlistSchema } from "./waitlist";

const valid = {
  email: "ala@gmail.com",
  subjects: ["polish"],
  maturaYear: "2027",
  consentPrivacy: true,
  ageConfirmed: true,
};

describe("waitlistSchema", () => {
  it("accepts a valid signup and turns empty UTM params into null", () => {
    const r = waitlistSchema.parse({ ...valid, utmSource: "", ref: "film1" });
    expect(r.utmSource).toBeNull();
    expect(r.ref).toBe("film1");
  });

  it("caps tracking params at 100 characters", () => {
    expect(waitlistSchema.safeParse({ ...valid, utmCampaign: "x".repeat(101) }).success).toBe(false);
  });

  it("requires consent", () => {
    expect(waitlistSchema.safeParse({ ...valid, consentPrivacy: false }).success).toBe(false);
  });

  it("gives a Polish message when subjects are missing", () => {
    const r = waitlistSchema.safeParse({ ...valid, subjects: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Zaznacz przynajmniej jeden przedmiot.");
  });
});
