import { beforeEach, describe, expect, it, vi } from "vitest";

const item = { findMany: vi.fn(), createMany: vi.fn() };
const section = { findMany: vi.fn(), createMany: vi.fn() };
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
    await expect(itemService.importMany("user-1", [])).resolves.toEqual({
      imported: 0,
      reused: 0,
      sectionsCreated: 0,
    });
    expect(item.createMany).not.toHaveBeenCalled();
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
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/"),
      entry("https://a.test/", { title: "Later duplicate" }),
    ]);

    expect(result.imported).toBe(1);
    expect(item.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("creates a section per folder and links the item to it", async () => {
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    section.findMany
      .mockResolvedValueOnce([]) // none exist
      .mockResolvedValueOnce([{ id: "s1", name: "Type" }]); // read back

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/", { folder: "Type" }),
    ]);

    expect(section.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", name: "Type" }],
      skipDuplicates: true,
    });
    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "i1", sectionId: "s1" }],
      skipDuplicates: true,
    });
    expect(result.sectionsCreated).toBe(1);
  });

  it("reuses a section the user already had", async () => {
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    const existing = [{ id: "s1", name: "Type" }];
    section.findMany.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

    const result = await itemService.importMany("user-1", [
      entry("https://a.test/", { folder: "Type" }),
    ]);

    expect(section.createMany).not.toHaveBeenCalled();
    expect(result.sectionsCreated).toBe(0);
  });

  it("keeps the original save time so the feed's order survives the move", async () => {
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

    await itemService.importMany("user-1", [
      entry("https://a.test/", { savedAt: "2020-09-13T12:26:41.000Z" }),
    ]);

    expect(item.createMany.mock.calls[0][0].data[0].savedAt).toEqual(
      new Date("2020-09-13T12:26:41.000Z"),
    );
  });

  it("lets the database default the date when the export had none", async () => {
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);

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
    item.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "i1", url: "https://a.test/" }]);
    tag.findMany.mockResolvedValue([{ id: "t1", name: "type" }]);

    await itemService.importMany("user-1", [entry("https://a.test/", { tags: ["type"] })]);

    expect(tag.createMany).toHaveBeenCalledTimes(1);
    expect(itemTag.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "i1", tagId: "t1" }],
      skipDuplicates: true,
    });
  });
});
