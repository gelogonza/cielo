import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const exportAll = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({ itemService: { exportAll } }));

const { GET } = await import("@/app/api/export/route");

const storedItem = {
  id: "item-1",
  url: "https://mymind.com",
  title: "mymind",
  body: null,
  thumbnailUrl: null,
  contentType: "LINK",
  sourceType: "WEB",
  sourcePlatform: "web",
  savedAt: new Date("2026-09-12T10:00:00.000Z"),
  sections: [{ section: { id: "s1", name: "Inspo" } }],
  tags: [{ tag: { id: "t1", name: "design" } }],
  note: { body: "the reference" },
};

function get(query = "") {
  return GET(new NextRequest(`http://localhost/api/export${query}`), {});
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  exportAll.mockReset();
  exportAll.mockResolvedValue([storedItem]);
});

describe("GET /api/export", () => {
  it("defaults to JSON", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toMatchObject({
      format: "cielo-export",
      version: 1,
      itemCount: 1,
    });
  });

  it("serializes items in the same shape the feed uses, plus the note", async () => {
    const { items } = await (await get()).json();

    expect(items[0]).toMatchObject({
      id: "item-1",
      url: "https://mymind.com",
      savedAt: "2026-09-12T10:00:00.000Z",
      sections: [{ id: "s1", name: "Inspo" }],
      tags: [{ id: "t1", name: "design" }],
      note: "the reference",
    });
  });

  it("returns bookmark HTML when asked for it", async () => {
    const response = await get("?format=html");

    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
  });

  it("sends both formats as a download with a dated filename", async () => {
    for (const [query, extension] of [
      ["", "json"],
      ["?format=html", "html"],
    ]) {
      const disposition = (await get(query)).headers.get("Content-Disposition");

      expect(disposition).toMatch(
        new RegExp(`^attachment; filename="cielo-(bookmarks-)?\\d{4}-\\d{2}-\\d{2}\\.${extension}"$`),
      );
    }
  });

  it("is never cached — this is the whole library", async () => {
    expect((await get()).headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("rejects a format it cannot produce", async () => {
    const response = await get("?format=csv");

    expect(response.status).toBe(400);
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("exports only the signed-in user's library", async () => {
    await get();

    expect(exportAll).toHaveBeenCalledWith("user-1");
  });

  it("refuses when signed out, without touching the database", async () => {
    getSessionUser.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("returns an empty but valid file for an empty library", async () => {
    exportAll.mockResolvedValue([]);

    expect(await (await get()).json()).toMatchObject({ itemCount: 0, items: [] });
    expect(await (await get("?format=html")).text()).toContain("<DL><p>");
  });
});
