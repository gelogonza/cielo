import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const rename = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/sections/section-service", () => ({ sectionService: { rename, remove } }));

const { PATCH, DELETE } = await import("@/app/api/sections/[id]/route");

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/sections/:id", () => {
  beforeEach(() => {
    rename.mockReset();
  });

  it("renames the section and returns it", async () => {
    rename.mockResolvedValue({ status: "renamed", section: { id: "section-1", name: "New name" } });

    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New name" }),
    });

    const response = await PATCH(request, context("section-1"));

    expect(rename).toHaveBeenCalledWith("user-1", "section-1", "New name");
    expect(response.status).toBe(200);
  });

  it("returns 404 when the section doesn't exist or isn't owned by the user", async () => {
    rename.mockResolvedValue({ status: "not-found" });

    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New name" }),
    });

    const response = await PATCH(request, context("section-1"));

    expect(response.status).toBe(404);
  });

  it("answers 409 when the user already has that section name, rather than merging", async () => {
    rename.mockResolvedValue({ status: "conflict" });

    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Design" }),
    });

    expect((await PATCH(request, context("section-1"))).status).toBe(409);
  });

  it("returns 400 without calling the service when name is missing", async () => {
    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });

    const response = await PATCH(request, context("section-1"));

    expect(response.status).toBe(400);
    expect(rename).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/sections/:id", () => {
  beforeEach(() => {
    remove.mockReset();
  });

  it("returns 204 when the section is deleted", async () => {
    remove.mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, context("section-1"));

    expect(remove).toHaveBeenCalledWith("user-1", "section-1");
    expect(response.status).toBe(204);
  });

  it("returns 404 when the section doesn't exist or isn't owned by the user", async () => {
    remove.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/sections/section-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, context("section-1"));

    expect(response.status).toBe(404);
  });
});
