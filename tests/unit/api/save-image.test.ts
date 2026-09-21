import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const saveUpload = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({ itemService: { saveUpload } }));

const { POST } = await import("@/app/api/save-image/route");

const savedItem = {
  id: "item-1",
  url: null,
  title: "A poster",
  body: null,
  thumbnailUrl: "user-1/abc.png",
  contentType: "IMAGE",
  sourceType: "DIRECT",
  sourcePlatform: null,
  savedAt: new Date("2026-09-19T10:00:00.000Z"),
  sections: [],
  tags: [],
};

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/save-image", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    {},
  );
}

const validBody = {
  objectKey: "user-1/abc.png",
  title: "A poster",
  contentType: "IMAGE",
  sectionIds: ["section-1"],
  tagNames: ["print"],
};

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  saveUpload.mockReset();
  saveUpload.mockResolvedValue(savedItem);
});

describe("POST /api/save-image", () => {
  it("creates the item and returns 201", async () => {
    const response = await post(validBody);

    expect(saveUpload).toHaveBeenCalledWith("user-1", expect.objectContaining(validBody));
    expect(response.status).toBe(201);
  });

  it("serves the image through a route, never the storage key", async () => {
    // The key is private and unfetchable; handing it to the browser would be
    // both useless and a leak.
    const body = await (await post(validBody)).json();

    expect(body.thumbnailUrl).toBe("/api/items/item-1/image");
    expect(JSON.stringify(body)).not.toContain("user-1/abc.png");
  });

  it("refuses a key belonging to someone else", async () => {
    const response = await post({ ...validBody, objectKey: "user-2/abc.png" });

    expect(response.status).toBe(403);
    expect(saveUpload).not.toHaveBeenCalled();
  });

  it("refuses a key that tries to climb out of its folder", async () => {
    expect((await post({ ...validBody, objectKey: "user-1/../user-2/a.png" })).status).toBe(403);
    expect(saveUpload).not.toHaveBeenCalled();
  });

  it("rejects a body that is not a save", async () => {
    expect((await post({ ...validBody, objectKey: "" })).status).toBe(400);
    expect((await post({ ...validBody, contentType: "LINK" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(saveUpload).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and writes nothing", async () => {
    getSessionUser.mockResolvedValue(null);

    expect((await post(validBody)).status).toBe(401);
    expect(saveUpload).not.toHaveBeenCalled();
  });
});
