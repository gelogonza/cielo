import { beforeEach, describe, expect, it, vi } from "vitest";

const item = { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() };
const section = { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() };
const tag = { createMany: vi.fn(), findMany: vi.fn() };
const itemSection = { createMany: vi.fn() };
const itemTag = { createMany: vi.fn() };

vi.mock("@/lib/db", () => ({ prisma: { item, section, tag, itemSection, itemTag } }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { findOrCreate: vi.fn() } }));
vi.mock("@/lib/scrape/scrape-url", () => ({ scrapeUrl: vi.fn() }));

const { itemService } = await import("@/lib/items/item-service");

function entry(url: string, overrides = {}) {
  return { url, title: "T", folder: null, tags: [], savedAt: null, ...overrides };
}

beforeEach(() => {
  for (const mock of [
    item.findMany,
    item.createMany,
    section.findMany,
    section.createMany,
    tag.createMany,
    tag.findMany,
    itemSection.createMany,
    itemTag.createMany,
  ]) {
    mock.mockReset();
  }

  item.findMany.mockResolvedValue([]);
  section.findMany.mockResolvedValue([]);
  tag.findMany.mockResolvedValue([]);
});

describe("ItemService.importMany", () => {
  it("does nothing for an empty file", async () => {
    const result = await itemService.importMany("user-1", []);

    expect(result).toMatchObject({ imported: 0, reused: 0, sectionsCreated: 0 });
    expect(item.createMany).not.toHaveBeenCalled();
  });

  it("stamps every run with a batch id so it can be undone", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    const result = await itemService.importMany("user-1", [entry("https://a.test/")]);

    expect(result.batchId).toMatch(/^[0-9a-f-]{36}$/);
    // Set on the rows it created, so undo can find exactly those.
    expect(item.createMany.mock.calls[0][0].data[0].importBatch).toBe(result.batchId);
  });

  it("creates the items it has not seen before", async () => {
    item.findMany
      .mockResolvedValueOnce([]) // existing lookup
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]); // read back

    const result = await itemService.importMany("user-1", [entry("https://a.test/")]);

    expect(item.createMany).toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 1, reused: 0 });
  });

  it("leaves an already-saved url alone rather than duplicating it", async () => {
    const existing = [{ id: "i1", url: "https://a.test/" }];
    item.findMany.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

    const result = await itemService.importMany("user-1", [entry("https://a.test/")]);

    expect(item.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 0, reused: 1 });
  });

  it("collapses duplicates inside one file", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/"),
      entry("https://a.test/", { title: "Later duplicate" }),
    ]);

    expect(result.imported).toBe(1);
    expect(item.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("creates a section per folder and links the item to it", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    section.findMany
      .mockResolvedValueOnce([]) // none exist
      .mockResolvedValueOnce([{ id: "s1", name: "Type" }]); // read back

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/", { folder: "Type" }),
    ]);

    expect(section.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", name: "Type", importBatch: expect.any(String) }],
      skipDuplicates: true,
    });
    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "i1", sectionId: "s1" }],
      skipDuplicates: true,
    });
    expect(result.sectionsCreated).toBe(1);
  });

  it("reuses a section the user already had", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    const existing = [{ id: "s1", name: "Type" }];
    section.findMany.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/", { folder: "Type" }),
    ]);

    expect(section.createMany).not.toHaveBeenCalled();
    expect(result.sectionsCreated).toBe(0);
  });

  it("keeps the original save time so the feed's order survives the move", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    await itemService.importMany("user-1", [
      entry("https://a.test/", { savedAt: "2020-09-13T12:26:41.000Z" }),
    ]);

    expect(item.createMany.mock.calls[0][0].data[0].savedAt).toEqual(
      new Date("2020-09-13T12:26:41.000Z"),
    );
  });

  it("lets the database default the date when the export had none", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    await itemService.importMany("user-1", [entry("https://a.test/")]);

    expect(item.createMany.mock.calls[0][0].data[0]).not.toHaveProperty("savedAt");
  });

  it("classifies the source platform from the url", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://www.tiktok.com/@u/video/1" }]);

    await itemService.importMany("user-1", [entry("https://www.tiktok.com/@u/video/1")]);

    expect(item.createMany.mock.calls[0][0].data[0].sourcePlatform).toBe("tiktok");
  });

  it("links tags without creating an item-by-item round trip", async () => {
    item.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    tag.findMany.mockResolvedValue([{ id: "t1", name: "type" }]);

    await itemService.importMany("user-1", [entry("https://a.test/", { tags: ["type"] })]);

    expect(tag.createMany).toHaveBeenCalledTimes(1);
    expect(itemTag.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "i1", tagId: "t1" }],
      skipDuplicates: true,
    });
  });
});

describe("ItemService.undoImport", () => {
  const deleteMany = item.deleteMany;
  const sectionFindMany = section.findMany;
  const sectionDeleteMany = section.deleteMany;

  beforeEach(() => {
    deleteMany.mockReset();
    sectionFindMany.mockReset();
    sectionDeleteMany.mockReset();
    sectionFindMany.mockResolvedValue([]);
  });

  it("removes only rows carrying that batch id", async () => {
    deleteMany.mockResolvedValue({ count: 4 });

    const result = await itemService.undoImport("user-1", "batch-1");

    // Scoped to the owner as well, so a guessed batch id reaches nothing.
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", importBatch: "batch-1" },
    });
    expect(result.itemsRemoved).toBe(4);
  });

  it("removes a section the import created once it is empty", async () => {
    deleteMany.mockResolvedValue({ count: 2 });
    sectionFindMany.mockResolvedValue([{ id: "s1", _count: { items: 0 } }]);
    sectionDeleteMany.mockResolvedValue({ count: 1 });

    const result = await itemService.undoImport("user-1", "batch-1");

    expect(sectionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] } } });
    expect(result.sectionsRemoved).toBe(1);
  });

  it("keeps a section the user has since filed something into", async () => {
    deleteMany.mockResolvedValue({ count: 2 });
    sectionFindMany.mockResolvedValue([{ id: "s1", _count: { items: 3 } }]);

    const result = await itemService.undoImport("user-1", "batch-1");

    expect(sectionDeleteMany).not.toHaveBeenCalled();
    expect(result.sectionsRemoved).toBe(0);
  });
});

describe("ItemService.removeMany", () => {
  const deleteMany = item.deleteMany;

  beforeEach(() => {
    deleteMany.mockReset();
  });

  it("deletes within the owner's scope only", async () => {
    deleteMany.mockResolvedValue({ count: 3 });

    const removed = await itemService.removeMany("user-1", ["a", "b", "c"]);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["a", "b", "c"] } },
    });
    expect(removed).toBe(3);
  });

  it("does not issue a query for an empty selection", async () => {
    await expect(itemService.removeMany("user-1", [])).resolves.toBe(0);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("reports only what actually matched, so another user's id is a no-op", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await expect(itemService.removeMany("user-1", ["mine", "theirs"])).resolves.toBe(1);
  });
});

describe("ItemService.importMany — url normalization", () => {
  it("collapses two spellings of one address into a single row", async () => {
    // The case that made re-importing your own export duplicate your library.
    const result = await itemService.importMany("user-1", [
      entry("https://mymind.com"),
      entry("https://mymind.com/"),
    ]);

    expect(result.imported).toBe(1);
    expect(item.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ url: "https://mymind.com/" })] }),
    );
  });

  it("matches an item that was saved with the other spelling", async () => {
    item.findMany.mockResolvedValue([{ id: "item-1", url: "https://mymind.com/" }]);

    const result = await itemService.importMany("user-1", [entry("https://mymind.com")]);

    expect(result).toMatchObject({ imported: 0, reused: 1 });
    expect(item.createMany).not.toHaveBeenCalled();
  });

  it("looks the entry up under its normalized url", async () => {
    await itemService.importMany("user-1", [entry("HTTPS://MyMind.com")]);

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", url: { in: ["https://mymind.com/"] } },
      }),
    );
  });

  it("drops an entry that is not a savable address", async () => {
    const result = await itemService.importMany("user-1", [
      entry("https://mymind.com/"),
      entry("javascript:void(0)"),
      entry("place:sort=8"),
    ]);

    expect(result.imported).toBe(1);
  });

  it("creates no sections for a file where every entry is junk", async () => {
    const result = await itemService.importMany("user-1", [
      entry("javascript:void(0)", { folder: "Bookmarklets" }),
    ]);

    expect(result).toMatchObject({ imported: 0, reused: 0, sectionsCreated: 0 });
    expect(section.createMany).not.toHaveBeenCalled();
    expect(item.createMany).not.toHaveBeenCalled();
  });
});
