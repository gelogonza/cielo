import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user);
const list = vi.fn();
const findOrCreate = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { list, findOrCreate } }));

const { GET, POST } = await import("@/app/api/tags/route");

describe("GET /api/tags", () => {
  it("returns the tags for the authenticated user", async () => {
    list.mockResolvedValue([{ id: "tag-1", name: "inspo", itemCount: 4 }]);

    const response = await GET(new NextRequest("http://localhost/api/tags"), {});

    expect(list).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tags: [{ id: "tag-1", name: "inspo", itemCount: 4 }] });
  });
});

describe("POST /api/tags", () => {
  beforeEach(() => {
    findOrCreate.mockReset();
  });

  it("returns 201 when a new tag is created", async () => {
    findOrCreate.mockResolvedValue({ tag: { id: "tag-1", name: "inspo" }, created: true });

    const request = new NextRequest("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "inspo" }),
    });

    const response = await POST(request, {});

    expect(findOrCreate).toHaveBeenCalledWith("user-1", "inspo");
    expect(response.status).toBe(201);
  });

  it("returns 200 when the tag already existed", async () => {
    findOrCreate.mockResolvedValue({ tag: { id: "tag-1", name: "inspo" }, created: false });

    const request = new NextRequest("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: "inspo" }),
    });

    const response = await POST(request, {});

    expect(response.status).toBe(200);
  });

  it("returns 400 without calling the service when name is missing", async () => {
    const request = new NextRequest("http://localhost/api/tags", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, {});

    expect(response.status).toBe(400);
    expect(findOrCreate).not.toHaveBeenCalled();
  });
});
