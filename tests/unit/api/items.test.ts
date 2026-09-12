import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const list = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({
  itemService: { list },
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
}));

const { GET } = await import("@/app/api/items/route");

const storedItem = {
  id: "item-1",
  url: "https://are.na/block/1",
  title: "Poster archive",
  body: null,
  thumbnailUrl: null,
  contentType: "LINK",
  sourceType: "WEB",
  sourcePlatform: "web",
  savedAt: new Date("2026-08-12T10:00:00.000Z"),
  sections: [],
  tags: [],
};

function get(query = "") {
  return GET(new NextRequest(`http://localhost/api/items${query}`), {});
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  list.mockReset();
  list.mockResolvedValue({ items: [storedItem], nextCursor: null });
});

describe("GET /api/items", () => {
  it("returns the contract's item shape with an ISO savedAt", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ ...storedItem, savedAt: "2026-08-12T10:00:00.000Z" }],
      nextCursor: null,
    });
  });

  it("defaults to the General view when no filter is given", async () => {
    await get();

    expect(list).toHaveBeenCalledWith("user-1", {});
  });

  it("passes section, tag, cursor and limit through to the service", async () => {
    await get("?sectionId=s1&tagId=t1&cursor=2026-08-01T00:00:00.000Z&limit=10");

    expect(list).toHaveBeenCalledWith("user-1", {
      sectionId: "s1",
      tagId: "t1",
      cursor: "2026-08-01T00:00:00.000Z",
      limit: 10,
    });
  });

  it("surfaces the nextCursor for the following page", async () => {
    list.mockResolvedValue({ items: [], nextCursor: "2026-08-01T00:00:00.000Z" });

    expect(await (await get()).json()).toMatchObject({ nextCursor: "2026-08-01T00:00:00.000Z" });
  });

  it("rejects a non-ISO cursor with 400", async () => {
    const response = await get("?cursor=yesterday");

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it("rejects a limit above the contract maximum with 400", async () => {
    const response = await get("?limit=500");

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and never queries items", async () => {
    getSessionUser.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });
});
