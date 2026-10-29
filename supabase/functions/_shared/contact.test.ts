import { describe, expect, it } from "vitest";
import { contactSchema, topicLabel } from "./contact";

const ok = { email: "Ala@Example.com ", topic: "bug", message: "Nie ładuje mi się arkusz z 2024." };

describe("contactSchema", () => {
  it("accepts a normal message and normalises the e-mail", () => {
    const r = contactSchema.safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("ala@example.com");
    expect(r.success && r.data.name).toBe("");
  });

  it("rejects a bad e-mail, an unknown topic and a too short or too long message", () => {
    expect(contactSchema.safeParse({ ...ok, email: "nie-mail" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, topic: "spam" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: "hej" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: "x".repeat(4001) }).success).toBe(false);
  });

  it("labels topics in Polish", () => {
    expect(topicLabel("bug")).toBe("Coś nie działa");
  });
});
