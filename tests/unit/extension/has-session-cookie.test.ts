import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "@/extension/src/lib/has-session-cookie";

describe("hasSessionCookie", () => {
  it("returns true for the unchunked cookie name", () => {
    expect(hasSessionCookie([{ name: "sb-abcdefgh-auth-token" }])).toBe(true);
  });

  it("returns true for a chunked cookie name (large JWTs split by @supabase/ssr)", () => {
    expect(hasSessionCookie([{ name: "sb-abcdefgh-auth-token.0" }])).toBe(true);
  });

  it("returns false when there is no matching cookie", () => {
    expect(hasSessionCookie([{ name: "unrelated-cookie" }])).toBe(false);
  });

  it("returns false for an empty cookie list", () => {
    expect(hasSessionCookie([])).toBe(false);
  });

  it("ignores cookies that merely contain 'sb-' without the auth-token suffix", () => {
    expect(hasSessionCookie([{ name: "sb-something-else" }])).toBe(false);
  });
});
