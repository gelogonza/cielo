import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/save?url=https%3A%2F%2Fare.na%2Fblock%2F1")).toBe(
      "/save?url=https%3A%2F%2Fare.na%2Fblock%2F1",
    );
  });

  it("falls back when nothing was supplied", () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it.each([
    "//evil.test/steal",
    "/\\evil.test",
    "https://evil.test",
    "http://evil.test",
    "javascript:alert(1)",
    "evil.test",
  ])("refuses %s so login cannot become an open redirect", (hostile) => {
    expect(safeNext(hostile)).toBe(DEFAULT_NEXT);
  });
});
