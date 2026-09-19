import { beforeEach, describe, expect, it, vi } from "vitest";

const item = { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
const section = { findMany: vi.fn() };
const tag = { findMany: vi.fn() };
const itemSection = { createMany: vi.fn() };
const itemTag = { createMany: vi.fn() };
const note = { createMany: vi.fn() };

const prisma = {
  item,
  section,
  tag,
  itemSection,
  itemTag,
  note,
  // The read-then-delete has to be atomic, so the service runs it in a
  // transaction; the double just hands the same client back.
  $transaction: vi.fn((run: (tx: unknown) => unknown) => run(prisma)),
};

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/tags/tag-service", () => ({ tagService: { findOrCreate: vi.fn() } }));
vi.mock("@/lib/scrape/scrape-url", () => ({ scrapeUrl: vi.fn() }));

const { itemService } = await import("@/lib/items/item-service");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    url: "https://mymind.com/",
    title: "mymind",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK",
    sourceType: "WEB",
    sourcePlatform: "web",
    savedAt: new Date("2026-09-12T10:00:00.000Z"),
    importBatch: null,
    sections: [{ sectionId: "s1" }],
    tags: [{ tagId: "t1" }],
    note: { body: "the reference" },
    ...overrides,
  };
}

function restorable(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    url: "https://mymind.com/",
    title: "mymind",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK" as const,
    sourceType: "WEB" as const,
    sourcePlatform: "web",
    savedAt: "2026-09-12T10:00:00.000Z",
    importBatch: null,
    sectionIds: ["s1"],
    tagIds: ["t1"],
    note: "the reference",
    ...overrides,
  };
}

beforeEach(() => {
  for (const mock of [
    item.findMany,
    item.deleteMany,
    item.createMany,
    section.findMany,
    tag.findMany,
    itemSection.createMany,
    itemTag.createMany,
    note.createMany,
    prisma.$transaction,
  ]) {
    mock.mockClear();
  }

  item.findMany.mockResolvedValue([]);
  item.deleteMany.mockResolvedValue({ count: 0 });
  section.findMany.mockResolvedValue([]);
  tag.findMany.mockResolvedValue([]);
});

describe("ItemService.removeMany", () => {
  it("deletes within the owner's scope only", async () => {
    item.findMany.mockResolvedValue([row(), row({ id: "item-2" }), row({ id: "item-3" })]);
    item.deleteMany.mockResolvedValue({ count: 3 });

    const result = await itemService.removeMany("user-1", ["item-1", "item-2", "item-3"]);

    expect(item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", id: { in: ["item-1", "item-2", "item-3"] } },
      }),
    );
    expect(result.deleted).toBe(3);
  });

  it("does not issue a query for an empty selection", async () => {
    await expect(itemService.removeMany("user-1", [])).resolves.toEqual({
      deleted: 0,
      restorable: [],
    });
    expect(item.deleteMany).not.toHaveBeenCalled();
  });

  it("reports only what actually matched, so another user's id is a no-op", async () => {
    item.findMany.mockResolvedValue([row()]);
    item.deleteMany.mockResolvedValue({ count: 1 });

    const result = await itemService.removeMany("user-1", ["mine", "theirs"]);

    expect(result.deleted).toBe(1);
    // Only the row that matched is deleted, and only it can be restored.
    expect(item.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["item-1"] } },
    });
    expect(result.restorable).toHaveLength(1);
  });

  it("reads and deletes in one transaction, so nothing is lost in between", async () => {
    item.findMany.mockResolvedValue([row()]);
    item.deleteMany.mockResolvedValue({ count: 1 });

    await itemService.removeMany("user-1", ["item-1"]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("hands back everything an undo needs, including what the feed never sees", async () => {
    item.findMany.mockResolvedValue([row({ importBatch: "batch-1" })]);
    item.deleteMany.mockResolvedValue({ count: 1 });

    const { restorable: snapshot } = await itemService.removeMany("user-1", ["item-1"]);

    expect(snapshot[0]).toEqual({
      id: "item-1",
      url: "https://mymind.com/",
      title: "mymind",
      body: null,
      thumbnailUrl: null,
      contentType: "LINK",
      sourceType: "WEB",
      sourcePlatform: "web",
      savedAt: "2026-09-12T10:00:00.000Z",
      // The note and the import batch are the two things the wire shape drops
      // and an undo cannot do without.
      importBatch: "batch-1",
      note: "the reference",
      sectionIds: ["s1"],
      tagIds: ["t1"],
    });
  });
});

describe("ItemService.restoreMany", () => {
  beforeEach(() => {
    section.findMany.mockResolvedValue([{ id: "s1" }]);
    tag.findMany.mockResolvedValue([{ id: "t1" }]);
    item.findMany.mockResolvedValue([{ id: "item-1" }]);
  });

  it("does nothing for an empty restore", async () => {
    await expect(itemService.restoreMany("user-1", [])).resolves.toEqual({ restored: 0 });
    expect(item.createMany).not.toHaveBeenCalled();
  });

  it("recreates the row under its original id, so this is an undo not a re-save", async () => {
    const result = await itemService.restoreMany("user-1", [restorable()]);

    expect(item.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "item-1",
          userId: "user-1",
          url: "https://mymind.com/",
          title: "mymind",
          body: null,
          thumbnailUrl: null,
          contentType: "LINK",
          sourceType: "WEB",
          sourcePlatform: "web",
          savedAt: new Date("2026-09-12T10:00:00.000Z"),
          importBatch: null,
        },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ restored: 1 });
  });

  it("takes userId from the session, never from the payload", async () => {
    await itemService.restoreMany("user-1", [
      { ...restorable(), userId: "someone-else" } as never,
    ]);

    expect(item.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ userId: "user-1" })] }),
    );
  });

  it("puts the sections, tags and note back", async () => {
    await itemService.restoreMany("user-1", [restorable()]);

    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", sectionId: "s1" }],
      skipDuplicates: true,
    });
    expect(itemTag.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", tagId: "t1" }],
      skipDuplicates: true,
    });
    expect(note.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", body: "the reference" }],
      skipDuplicates: true,
    });
  });

  it("drops a section id the user does not own", async () => {
    // Otherwise a crafted payload could file an item into someone else's
    // section.
    section.findMany.mockResolvedValue([]);

    await itemService.restoreMany("user-1", [restorable({ sectionIds: ["someone-elses"] })]);

    expect(section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", id: { in: ["someone-elses"] } },
      }),
    );
    expect(itemSection.createMany).not.toHaveBeenCalled();
  });

  it("drops a section that has been deleted since, rather than failing", async () => {
    section.findMany.mockResolvedValue([{ id: "s1" }]);

    await itemService.restoreMany("user-1", [restorable({ sectionIds: ["s1", "gone"] })]);

    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", sectionId: "s1" }],
      skipDuplicates: true,
    });
  });

  it("skips an item whose url was saved again in the meantime", async () => {
    // createMany skips the conflict; only rows that landed get relations.
    item.findMany.mockResolvedValue([{ id: "item-1" }]);

    const result = await itemService.restoreMany("user-1", [
      restorable(),
      restorable({ id: "item-2" }),
    ]);

    expect(result).toEqual({ restored: 1 });
    expect(itemSection.createMany).toHaveBeenCalledWith({
      data: [{ itemId: "item-1", sectionId: "s1" }],
      skipDuplicates: true,
    });
  });

  it("writes no note row for an item that had none", async () => {
    await itemService.restoreMany("user-1", [restorable({ note: null })]);

    expect(note.createMany).not.toHaveBeenCalled();
  });
});
