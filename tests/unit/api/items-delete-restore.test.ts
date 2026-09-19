import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", email: "person@example.com" };
const getSessionUser = vi.fn(async () => user as typeof user | null);
const removeMany = vi.fn();
const restoreMany = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/items/item-service", () => ({
  itemService: { removeMany, restoreMany },
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
}));

const { DELETE } = await import("@/app/api/items/route");
const { POST } = await import("@/app/api/items/restore/route");

function restorable(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    url: "https://mymind.com/",
    title: "mymind",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK",
    sourceType: "WEB",
    sourcePlatform: "web",
    savedAt: "2026-09-12T10:00:00.000Z",
    importBatch: null,
    sectionIds: ["s1"],
    tagIds: ["t1"],
    note: "the reference",
    ...overrides,
  };
}

function del(body: unknown) {
  return DELETE(
    new NextRequest("http://localhost/api/items", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
    {},
  );
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/items/restore", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    {},
  );
}

beforeEach(() => {
  getSessionUser.mockResolvedValue(user);
  removeMany.mockReset();
  restoreMany.mockReset();

  removeMany.mockResolvedValue({ deleted: 1, restorable: [restorable()] });
  restoreMany.mockResolvedValue({ restored: 1 });
});

describe("DELETE /api/items", () => {
  it("deletes the ids and reports what matched", async () => {
    const response = await del({ ids: ["item-1"] });

    expect(removeMany).toHaveBeenCalledWith("user-1", ["item-1"]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: 1 });
  });

  it("hands back a snapshot the client can undo from", async () => {
    // The whole point: without this the delete is permanent.
    const { restorable: snapshot } = await (await del({ ids: ["item-1"] })).json();

    expect(snapshot).toEqual([restorable()]);
  });

  it("rejects an empty or oversized selection", async () => {
    expect((await del({ ids: [] })).status).toBe(400);
    expect((await del({ ids: Array.from({ length: 501 }, (_, i) => `id-${i}`) })).status).toBe(400);
    expect(removeMany).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and deletes nothing", async () => {
    getSessionUser.mockResolvedValue(null);

    expect((await del({ ids: ["item-1"] })).status).toBe(401);
    expect(removeMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/items/restore", () => {
  it("puts the snapshot back and reports how much landed", async () => {
    const response = await post({ items: [restorable()] });

    expect(restoreMany).toHaveBeenCalledWith("user-1", [restorable()]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ restored: 1 });
  });

  it("round-trips the snapshot a delete produced, unchanged", async () => {
    const { restorable: snapshot } = await (await del({ ids: ["item-1"] })).json();

    await post({ items: snapshot });

    expect(restoreMany).toHaveBeenCalledWith("user-1", snapshot);
  });

  it("restores as the signed-in user, whatever the payload claims", async () => {
    await post({ items: [{ ...restorable(), userId: "someone-else" }] });

    expect(restoreMany).toHaveBeenCalledWith("user-1", expect.any(Array));
    // The extra field is stripped by the schema rather than passed through.
    expect(restoreMany.mock.calls[0][1][0]).not.toHaveProperty("userId");
  });

  it("rejects a payload that is not a restorable item", async () => {
    expect((await post({ items: [{ id: "item-1" }] })).status).toBe(400);
    expect((await post({ items: [{ ...restorable(), contentType: "NOPE" }] })).status).toBe(400);
    expect((await post({ items: [{ ...restorable(), savedAt: "yesterday" }] })).status).toBe(400);
    expect(restoreMany).not.toHaveBeenCalled();
  });

  it("rejects an empty or oversized restore", async () => {
    expect((await post({ items: [] })).status).toBe(400);
    expect(
      (await post({ items: Array.from({ length: 501 }, () => restorable()) })).status,
    ).toBe(400);
    expect(restoreMany).not.toHaveBeenCalled();
  });

  it("returns 401 without a session and restores nothing", async () => {
    getSessionUser.mockResolvedValue(null);

    expect((await post({ items: [restorable()] })).status).toBe(401);
    expect(restoreMany).not.toHaveBeenCalled();
  });
});
