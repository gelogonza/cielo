import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const search = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({
  itemService: { search },
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
}));

const { GET } = await import("@/app/api/search/route");

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
  sections: [],
  tags: [],
};

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/search${query}`), {});
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  search.mockReset();
  search.mockResolvedValue({ items: [storedItem], nextCursor: null });
});

describe("GET /api/search", () => {
  it("returns the same item shape as the feed", async () => {
    const response = await get("?q=mymind");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ ...storedItem, savedAt: "2026-09-12T10:00:00.000Z" }],
      nextCursor: null,
    });
  });

  it("passes the query, cursor and limit through", async () => {
    await get("?q=ocean&cursor=2026-09-01T00:00:00.000Z&limit=10");

    expect(search).toHaveBeenCalledWith("user-1", {
      q: "ocean",
      cursor: "2026-09-01T00:00:00.000Z",
      limit: 10,
    });
  });

  it("answers an empty query with no results rather than a 400", async () => {
    // The field starts empty; a 400 would be a state the UI has to special-case.
    const response = await get("?q=");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(search).not.toHaveBeenCalled();
  });

  it("answers a whitespace-only query the same way", async () => {
    expect((await (await get("?q=%20%20")).json()).items).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("surfaces a nextCursor for paging", async () => {
    search.mockResolvedValue({ items: [], nextCursor: "2026-09-01T00:00:00.000Z" });

    expect(await (await get("?q=x")).json()).toMatchObject({
      nextCursor: "2026-09-01T00:00:00.000Z",
    });
  });

  it("rejects a limit above the contract maximum", async () => {
    const response = await get("?q=x&limit=500");

    // Falls back to the empty-result contract rather than erroring.
    expect(response.status).toBe(200);
    expect(search).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and never searches", async () => {
    getSessionUser.mockResolvedValue(null);

    expect((await get("?q=x")).status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });
});
