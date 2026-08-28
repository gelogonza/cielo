import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

const { getSessionUser } = await import("@/lib/auth/session");

describe("getSessionUser", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("returns null when there is no valid session", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("no session") });

    expect(await getSessionUser()).toBeNull();
  });

  it("returns the user id and email when the session is valid", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-123", email: "person@example.com" } },
      error: null,
    });

    expect(await getSessionUser()).toEqual({ id: "user-123", email: "person@example.com" });
  });

  it("returns null when the claims have no email", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    expect(await getSessionUser()).toBeNull();
  });
});
