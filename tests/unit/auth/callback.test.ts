import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("@/app/auth/callback/route");

function callback(query: string) {
  return GET(new NextRequest(`http://localhost/auth/callback${query}`));
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("exchanges the code and lands the user in the library", async () => {
    const response = await callback("?code=abc123");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("http://localhost/library");
  });

  it("honours an explicit next destination", async () => {
    const response = await callback("?code=abc123&next=/library?section=1");

    expect(response.headers.get("location")).toContain("/library");
  });

  it("bounces back to login when no code came back", async () => {
    const response = await callback("");

    expect(response.headers.get("location")).toBe("http://localhost/login?error=missing_code");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("bounces back to login when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });

    const response = await callback("?code=abc123");

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?error=auth_callback_failed",
    );
  });
});
