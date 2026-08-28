import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const remove = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { remove } }));

const { DELETE } = await import("@/app/api/tags/[id]/route");

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/tags/:id", () => {
  beforeEach(() => {
    remove.mockReset();
  });

  it("returns 204 when the tag is deleted", async () => {
    remove.mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/tags/tag-1", { method: "DELETE" });
    const response = await DELETE(request, context("tag-1"));

    expect(remove).toHaveBeenCalledWith("user-1", "tag-1");
    expect(response.status).toBe(204);
  });

  it("returns 404 when the tag doesn't exist or isn't owned by the user", async () => {
    remove.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/tags/tag-1", { method: "DELETE" });
    const response = await DELETE(request, context("tag-1"));

    expect(response.status).toBe(404);
  });
});
