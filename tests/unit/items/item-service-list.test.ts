import { beforeEach, describe, expect, it, vi } from "vitest";

const item = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
};
const itemSection = { deleteMany: vi.fn(), createMany: vi.fn() };
const itemTag = { deleteMany: vi.fn(), createMany: vi.fn() };
const section = { findMany: vi.fn() };
const note = { upsert: vi.fn(), deleteMany: vi.fn() };
const findOrCreateTag = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: { item, itemSection, itemTag, section, note } }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { findOrCreate: findOrCreateTag } }));
vi.mock("@/lib/scrape/scrape-url", () => ({ scrapeUrl: vi.fn() }));

const { itemService, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = await import("@/lib/items/item-service");

function row(id: string, savedAt: string) {
  return { id, savedAt: new Date(savedAt), sections: [], tags: [] };
}

beforeEach(() => {
  for (const mock of [
    item.findMany,
    item.findFirst,
    item.findUniqueOrThrow,
    item.deleteMany,
    item.count,
    itemSection.deleteMany,
    itemSection.createMany,
    itemTag.deleteMany,
    itemTag.createMany,
    section.findMany,
    note.upsert,
    note.deleteMany,
    findOrCreateTag,
  ]) {
    mock.mockReset();
  }
  section.findMany.mockResolvedValue([]);
});

describe("ItemService.list", () => {
  it("scopes the query to the session user and sorts newest first", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1");

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { savedAt: "desc" },
      }),
    );
  });

  it("requests one row beyond the page size to detect a next page", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1", { limit: 5 });

    expect(item.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
  });

  it("returns a nextCursor and trims the extra row when more remain", async () => {
    item.findMany.mockResolvedValue([
      row("a", "2026-08-03T00:00:00.000Z"),
      row("b", "2026-08-02T00:00:00.000Z"),
      row("c", "2026-08-01T00:00:00.000Z"),
    ]);

    const result = await itemService.list("user-1", { limit: 2 });

    expect(result.items.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(result.nextCursor).toBe("2026-08-02T00:00:00.000Z");
  });

  it("returns a null cursor on the last page", async () => {
    item.findMany.mockResolvedValue([row("a", "2026-08-03T00:00:00.000Z")]);

    const result = await itemService.list("user-1", { limit: 2 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("filters by section and tag when both are supplied", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1", { sectionId: "section-1", tagId: "tag-1" });

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          sections: { some: { sectionId: "section-1" } },
          tags: { some: { tagId: "tag-1" } },
        },
      }),
    );
  });

  it("pages strictly past the cursor so the boundary item is not repeated", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1", { cursor: "2026-08-02T00:00:00.000Z" });

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", savedAt: { lt: new Date("2026-08-02T00:00:00.000Z") } },
      }),
    );
  });

  it("caps an oversized limit at MAX_PAGE_SIZE", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1", { limit: 500 });

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_PAGE_SIZE + 1 }),
    );
  });

  it("defaults to DEFAULT_PAGE_SIZE", async () => {
    item.findMany.mockResolvedValue([]);

    await itemService.list("user-1");

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_PAGE_SIZE + 1 }),
    );
  });
});

describe("ItemService.get / remove", () => {
  it("looks an item up by id scoped to its owner", async () => {
    item.findFirst.mockResolvedValue(row("a", "2026-08-01T00:00:00.000Z"));

    await itemService.get("user-1", "item-1");

    expect(item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1", userId: "user-1" } }),
    );
  });

  it("deletes only within the owner's scope", async () => {
    item.deleteMany.mockResolvedValue({ count: 1 });

    await expect(itemService.remove("user-1", "item-1")).resolves.toBe(true);
    expect(item.deleteMany).toHaveBeenCalledWith({ where: { id: "item-1", userId: "user-1" } });
  });

  it("reports false when another user's item did not match", async () => {
    item.deleteMany.mockResolvedValue({ count: 0 });

    await expect(itemService.remove("user-1", "item-1")).resolves.toBe(false);
  });
});

describe("ItemService.setSectionsAndTags", () => {
  it("refuses to touch an item the user does not own", async () => {
    item.findFirst.mockResolvedValue(null);

    await expect(
      itemService.setSectionsAndTags("user-1", "item-1", { sectionIds: ["s"] }),
    ).resolves.toBeNull();
    expect(itemSection.deleteMany).not.toHaveBeenCalled();
  });

  it("clears existing sections before attaching the new set", async () => {
    item.findFirst.mockResolvedValue({ id: "item-1" });
    item.findUniqueOrThrow.mockResolvedValue(row("item-1", "2026-08-01T00:00:00.000Z"));
    section.findMany.mockResolvedValue([{ id: "section-1" }]);

    await itemService.setSectionsAndTags("user-1", "item-1", { sectionIds: ["section-1"] });

    expect(itemSection.deleteMany).toHaveBeenCalledWith({ where: { itemId: "item-1" } });
    expect(itemSection.createMany).toHaveBeenCalled();
  });

  it("leaves tags untouched when only sections are supplied", async () => {
    item.findFirst.mockResolvedValue({ id: "item-1" });
    item.findUniqueOrThrow.mockResolvedValue(row("item-1", "2026-08-01T00:00:00.000Z"));

    await itemService.setSectionsAndTags("user-1", "item-1", { sectionIds: [] });

    expect(itemTag.deleteMany).not.toHaveBeenCalled();
  });
});

describe("ItemService note handling", () => {
  it("upserts so a second save replaces rather than duplicates the note", async () => {
    item.findFirst.mockResolvedValue({ id: "item-1" });
    note.upsert.mockResolvedValue({ id: "note-1" });

    await itemService.setNote("user-1", "item-1", "Grid reference");

    expect(note.upsert).toHaveBeenCalledWith({
      where: { itemId: "item-1" },
      create: { itemId: "item-1", body: "Grid reference" },
      update: { body: "Grid reference" },
    });
  });

  it("will not write a note onto another user's item", async () => {
    item.findFirst.mockResolvedValue(null);

    await expect(itemService.setNote("user-1", "item-1", "x")).resolves.toBeNull();
    expect(note.upsert).not.toHaveBeenCalled();
  });

  it("will not delete a note from another user's item", async () => {
    item.findFirst.mockResolvedValue(null);

    await expect(itemService.removeNote("user-1", "item-1")).resolves.toBe(false);
    expect(note.deleteMany).not.toHaveBeenCalled();
  });
});
