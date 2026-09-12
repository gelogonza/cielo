import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

const signoutRoute = await import("@/app/auth/signout/route");

describe("POST /auth/signout", () => {
  it("clears the Supabase session and sends the user to the landing page", async () => {
    const response = await signoutRoute.POST(
      new NextRequest("http://localhost/auth/signout", { method: "POST" }),
    );

    expect(signOut).toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("exposes no GET handler, so a cross-site tag cannot log the user out", () => {
    expect("GET" in signoutRoute).toBe(false);
  });
});
