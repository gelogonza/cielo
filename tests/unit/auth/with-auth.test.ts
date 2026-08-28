import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const { withAuth } = await import("@/lib/auth/with-auth");

describe("withAuth", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
  });

  it("returns 401 and never calls the wrapped handler when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);
    const innerHandler = vi.fn();
    const request = new NextRequest("http://localhost/api/items");

    const response = await withAuth(innerHandler)(request, {});

    expect(response.status).toBe(401);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("calls the wrapped handler with the authenticated user when the session is valid", async () => {
    const user = { id: "user-123", email: "person@example.com" };
    getSessionUser.mockResolvedValue(user);
    const innerHandler = vi.fn(async () => NextResponse.json({ ok: true }));
    const request = new NextRequest("http://localhost/api/items");
    const context = {};

    const response = await withAuth(innerHandler)(request, context);

    expect(innerHandler).toHaveBeenCalledWith(request, context, user);
    expect(await response.json()).toEqual({ ok: true });
  });
});
