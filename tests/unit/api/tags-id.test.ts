import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const remove = vi.fn();
const rename = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { remove, rename } }));

const { DELETE, PATCH } = await import("@/app/api/tags/[id]/route");

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

describe("PATCH /api/tags/:id", () => {
  function patch(body: unknown) {
    return PATCH(
      new NextRequest("http://localhost/api/tags/tag-1", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "tag-1" }) },
    );
  }

  beforeEach(() => {
    rename.mockReset();
  });

  it("renames the tag and returns it", async () => {
    rename.mockResolvedValue({ status: "renamed", tag: { id: "tag-1", name: "typography" } });

    const response = await patch({ name: "typography" });

    expect(rename).toHaveBeenCalledWith("user-1", "tag-1", "typography");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "tag-1", name: "typography" });
  });

  it("answers 409 when the user already has that tag, rather than merging", async () => {
    rename.mockResolvedValue({ status: "conflict" });

    const response = await patch({ name: "type" });

    expect(response.status).toBe(409);
  });

  it("answers 404 for a tag that is not this user's", async () => {
    rename.mockResolvedValue({ status: "not-found" });

    expect((await patch({ name: "type" })).status).toBe(404);
  });

  it("answers 400 for a blank name, without calling the service", async () => {
    expect((await patch({ name: "   " })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(rename).not.toHaveBeenCalled();
  });
});
