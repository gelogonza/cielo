import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const get = vi.fn();
const removeMany = vi.fn();
const setSectionsAndTags = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({
  itemService: { get, removeMany, setSectionsAndTags },
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
  removeMany.mockReset();
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
  it("deletes the item and hands back the snapshot an undo needs", async () => {
    // Same shape as the bulk delete, so one item and twenty undo the same way.
    removeMany.mockResolvedValue({ deleted: 1, restorable: [{ id: "item-1" }] });

    const response = await DELETE(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(removeMany).toHaveBeenCalledWith("user-1", ["item-1"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 1, restorable: [{ id: "item-1" }] });
  });

  it("returns 404 when nothing matched the owner scope", async () => {
    removeMany.mockResolvedValue({ deleted: 0, restorable: [] });

    const response = await DELETE(new NextRequest("http://localhost/api/items/item-1"), context);

    expect(response.status).toBe(404);
  });
});
