import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const get = vi.fn();
const remove = vi.fn();
const setSectionsAndTags = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({
  itemService: { get, remove, setSectionsAndTags },
}));

const { GET, PATCH, DELETE } = await import("@/app/api/items/[id]/route");

const context = { params: Promise.resolve({ id: "item-1" }) };
const storedItem = {
  id: "item-1",
  url: null,
  title: "Poster archive",
  thumbnailUrl: null,
  contentType: "LINK",
  sourceType: "WEB",
  sourcePlatform: null,
  savedAt: new Date("2026-08-12T10:00:00.000Z"),
  sections: [],
  tags: [],
};

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/items/item-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  get.mockReset();
  remove.mockReset();
  setSectionsAndTags.mockReset();
});

describe("GET /api/items/:id", () => {
  it("returns the serialized item", async () => {
    get.mockResolvedValue(storedItem);

    const response = await GET(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "item-1",
      savedAt: "2026-08-12T10:00:00.000Z",
    });
  });

  it("returns 404 for an item belonging to someone else", async () => {
    get.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/items/:id", () => {
  it("applies a replacement set of sections", async () => {
    setSectionsAndTags.mockResolvedValue(storedItem);

    const response = await PATCH(patchRequest({ sectionIds: ["s1", "s2"] }), context);

    expect(setSectionsAndTags).toHaveBeenCalledWith("user-1", "item-1", {
      sectionIds: ["s1", "s2"],
    });
    expect(response.status).toBe(200);
  });

  it("accepts an empty section list as a full detach", async () => {
    setSectionsAndTags.mockResolvedValue(storedItem);

    await PATCH(patchRequest({ sectionIds: [] }), context);

    expect(setSectionsAndTags).toHaveBeenCalledWith("user-1", "item-1", { sectionIds: [] });
  });

  it("rejects a blank tag name with 400", async () => {
    const response = await PATCH(patchRequest({ tagNames: ["  "] }), context);

    expect(response.status).toBe(400);
    expect(setSectionsAndTags).not.toHaveBeenCalled();
  });

  it("returns 404 when the item is not the caller's", async () => {
    setSectionsAndTags.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ tagNames: ["poster"] }), context);

    expect(response.status).toBe(404);
  });

  it("returns 401 without a session", async () => {
    getSessionUser.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ sectionIds: [] }), context);

    expect(response.status).toBe(401);
    expect(setSectionsAndTags).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/items/:id", () => {
  it("returns 204 with no body once deleted", async () => {
    remove.mockResolvedValue(true);

    const response = await DELETE(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns 404 when nothing matched the owner scope", async () => {
    remove.mockResolvedValue(false);

    const response = await DELETE(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(response.status).toBe(404);
  });
});
