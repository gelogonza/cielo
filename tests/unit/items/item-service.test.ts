import { beforeEach, describe, expect, it, vi } from "vitest";

const item = {
  findUnique: vi.fn(),
  create: vi.fn(),
  findUniqueOrThrow: vi.fn(),
};
const section = { findMany: vi.fn() };
const itemSection = { createMany: vi.fn() };
const itemTag = { createMany: vi.fn() };
const findOrCreateTag = vi.fn();
const scrapeUrl = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: { item, section, itemSection, itemTag } }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { findOrCreate: findOrCreateTag } }));
vi.mock("@/lib/scrape/scrape-url", () => ({ scrapeUrl }));

const { itemService } = await import("@/lib/items/item-service");

const baseInput = {
  url: "https://example.com/post",
  title: "Provided title",
  thumbnailUrl: "https://example.com/thumb.jpg",
  contentType: "LINK" as const,
  sourcePlatform: "web",
  sectionIds: [],
  tagNames: [],
};

const loadedItem = {
  id: "item-1",
  url: baseInput.url,
  title: baseInput.title,
  thumbnailUrl: baseInput.thumbnailUrl,
  contentType: "LINK",
  sourceType: "WEB",
  sourcePlatform: "web",
  savedAt: new Date("2026-01-01"),
  sections: [],
  tags: [],
};

describe("ItemService.saveLink", () => {
  beforeEach(() => {
    item.findUnique.mockReset();
    item.create.mockReset();
    item.findUniqueOrThrow.mockReset();
    section.findMany.mockReset();
    itemSection.createMany.mockReset();
    itemTag.createMany.mockReset();
    findOrCreateTag.mockReset();
    scrapeUrl.mockReset();

    section.findMany.mockResolvedValue([]);
    item.findUniqueOrThrow.mockResolvedValue(loadedItem);
  });

  it("creates a new item when none exists for this user and url", async () => {
    item.findUnique.mockResolvedValue(null);
    item.create.mockResolvedValue({ id: "item-1" });

    const result = await itemService.saveLink("user-1", baseInput);

    expect(item.findUnique).toHaveBeenCalledWith({
      where: { unique_user_url: { userId: "user-1", url: baseInput.url } },
    });
    expect(item.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        url: baseInput.url,
        title: "Provided title",
        body: null,
        thumbnailUrl: "https://example.com/thumb.jpg",
        contentType: "LINK",
        sourceType: "WEB",
        sourcePlatform: "web",
      },
    });
    expect(scrapeUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ item: loadedItem, reused: false });
  });

  it("scrapes the page for title/thumbnail when thumbnailUrl is missing", async () => {
    item.findUnique.mockResolvedValue(null);
    item.create.mockResolvedValue({ id: "item-1" });
    scrapeUrl.mockResolvedValue({
      title: "Scraped title",
      thumbnailUrl: "https://example.com/og.jpg",
    });

    await itemService.saveLink("user-1", { ...baseInput, title: null, thumbnailUrl: null });

    expect(scrapeUrl).toHaveBeenCalledWith(baseInput.url);
    expect(item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Scraped title",
        thumbnailUrl: "https://example.com/og.jpg",
      }),
    });
  });

  it("reuses an existing item instead of creating a new row", async () => {
    item.findUnique.mockResolvedValue({ id: "item-1" });

    const result = await itemService.saveLink("user-1", baseInput);

    expect(item.create).not.toHaveBeenCalled();
    expect(scrapeUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ item: loadedItem, reused: true });
  });

  it("attaches new sections and tags to a reused item", async () => {
    item.findUnique.mockResolvedValue({ id: "item-1" });
    section.findMany.mockResolvedValue([{ id: "section-1" }]);
    findOrCreateTag.mockResolvedValue({ tag: { id: "tag-1", name: "inspo" }, created: false });

    await itemService.saveLink("user-1", {
      ...baseInput,
      sectionIds: ["section-1"],
      tagNames: ["inspo"],
    });

    expect(section.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["section-1"] }, userId: "user-1" },
      select: { id: true },
    });
    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", sectionId: "section-1" }],
      skipDuplicates: true,
    });
    expect(findOrCreateTag).toHaveBeenCalledWith("user-1", "inspo");
    expect(itemTag.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", tagId: "tag-1" }],
      skipDuplicates: true,
    });
  });

  it("silently drops sectionIds not owned by the user instead of attaching them", async () => {
    item.findUnique.mockResolvedValue({ id: "item-1" });
    // Only section-1 comes back as owned; section-2 (someone else's) doesn't.
    section.findMany.mockResolvedValue([{ id: "section-1" }]);

    await itemService.saveLink("user-1", {
      ...baseInput,
      sectionIds: ["section-1", "someone-elses-section"],
    });

    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", sectionId: "section-1" }],
      skipDuplicates: true,
    });
  });

  it("skips the join-table calls entirely when no sections or tags are given", async () => {
    item.findUnique.mockResolvedValue({ id: "item-1" });

    await itemService.saveLink("user-1", baseInput);

    expect(itemSection.createMany).not.toHaveBeenCalled();
    expect(itemTag.createMany).not.toHaveBeenCalled();
  });
});

describe("ItemService.saveLink — url normalization", () => {
  beforeEach(() => {
    for (const mock of [
      item.findUnique,
      item.create,
      item.findUniqueOrThrow,
      section.findMany,
      itemSection.createMany,
      itemTag.createMany,
      findOrCreateTag,
      scrapeUrl,
    ]) {
      mock.mockReset();
    }

    section.findMany.mockResolvedValue([]);
    item.findUniqueOrThrow.mockResolvedValue(loadedItem);
    item.findUnique.mockResolvedValue(null);
    item.create.mockResolvedValue({ id: "item-1" });
  });

  it("dedupes against the normalized url, not the one it was handed", async () => {
    // A save of "https://mymind.com" must find the row stored as
    // "https://mymind.com/" — this is what import already did and save did not.
    await itemService.saveLink("user-1", { ...baseInput, url: "https://mymind.com" });

    expect(item.findUnique).toHaveBeenCalledWith({
      where: { unique_user_url: { userId: "user-1", url: "https://mymind.com/" } },
    });
  });

  it("stores the normalized url", async () => {
    await itemService.saveLink("user-1", { ...baseInput, url: "HTTPS://MyMind.com:443" });

    expect(item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: "https://mymind.com/" }),
      }),
    );
  });

  it("leaves a sourceless highlight sourceless", async () => {
    await itemService.saveLink("user-1", {
      ...baseInput,
      url: null,
      body: "a line worth keeping",
      contentType: "TEXT",
    });

    expect(item.findUnique).not.toHaveBeenCalled();
    expect(item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: null, sourceType: "DIRECT" }),
      }),
    );
  });

  it("keeps a url it cannot normalize rather than turning a link into a quote", async () => {
    // Routes reject these; this only covers a caller that did not.
    await itemService.saveLink("user-1", { ...baseInput, url: "not a url" });

    expect(item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: "not a url", sourceType: "WEB" }),
      }),
    );
  });
});
