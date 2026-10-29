// Contact form function against the REAL project: bad input is refused, the honeypot quietly
// "succeeds" for bots. (A valid message would land in contact_messages, so it isn't sent here.)

import { describe, expect, it } from "vitest";
import { SUPABASE } from "@/config/site";

const url = `${SUPABASE.url}/functions/v1/contact-submit`;
const post = (body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("contact-submit function", () => {
  it("refuses invalid messages with field errors", async () => {
    const res = await post({ email: "nie-mail", topic: "bug", message: "hej" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.fieldErrors).sort()).toEqual(["email", "message"]);
  });

  it("answers OK to bots that fill in the honeypot (and saves nothing)", async () => {
    const res = await post({ email: "bot@example.com", topic: "other", message: "Kup tanie zegarki!!!", website: "x" });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("refuses oversized requests", async () => {
    const res = await post({ email: "a@b.pl", topic: "other", message: "x".repeat(20000) });
    expect(res.status).toBe(413);
  });
});
