import { describe, expect, it } from "vitest";
import { ROUTES, safeNextPath } from "./routes";

describe("safeNextPath", () => {
  it("allows our own paths", () => {
    expect(safeNextPath("/konto")).toBe("/konto");
    expect(safeNextPath("/panel?tab=1")).toBe("/panel?tab=1");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("falls back to the dashboard for %s", (next) => {
    expect(safeNextPath(next)).toBe(ROUTES.dashboard);
  });
});
