import { describe, expect, it } from "vitest";
import { authErrorMessage, passwordSchema, profileSchema, signupSchema } from "./auth";

describe("passwordSchema", () => {
  it.each(["haslo123", "Matura2027", "a1b2c3d4"])("accepts %s", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(true);
  });

  it.each([
    ["abc12", "too short"],
    ["abcdefgh", "no digit"],
    ["12345678", "no letter"],
  ])("rejects %s (%s)", (pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = { email: " Ala@Gmail.com ", password: "haslo123", acceptTerms: true, ageConfirmed: true };

  it("normalises the email", () => {
    const r = signupSchema.parse(valid);
    expect(r.email).toBe("ala@gmail.com");
  });

  it("requires accepting the terms and confirming age", () => {
    expect(signupSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, ageConfirmed: false }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("dedupes subjects and trims the name", () => {
    const r = profileSchema.parse({ displayName: "  Ala ", subjects: ["polish", "polish"], maturaYear: "2027" });
    expect(r).toEqual({ displayName: "Ala", subjects: ["polish"], maturaYear: "2027" });
  });

  it("rejects unknown subjects and years", () => {
    expect(profileSchema.safeParse({ displayName: "A", subjects: ["maths"], maturaYear: "2027" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "A", subjects: ["polish"], maturaYear: "2030" }).success).toBe(false);
  });

  it("requires at least one subject", () => {
    expect(profileSchema.safeParse({ displayName: "A", subjects: [], maturaYear: "2027" }).success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("translates known codes and falls back for unknown ones", () => {
    expect(authErrorMessage("invalid_credentials")).toMatch(/Nieprawidłowy/);
    expect(authErrorMessage("something_new")).toMatch(/Coś poszło nie tak/);
  });
});
