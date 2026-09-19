import { beforeEach, describe, expect, it, vi } from "vitest";

const tag = {
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: { tag } }));

const { Prisma } = await import("@/lib/generated/prisma/client");
const { tagService } = await import("@/lib/tags/tag-service");

describe("TagService", () => {
  beforeEach(() => {
    tag.create.mockReset();
    tag.findMany.mockReset();
    tag.findUniqueOrThrow.mockReset();
    tag.deleteMany.mockReset();
  });

  it("creates a new tag when the name doesn't exist yet for the user", async () => {
    tag.create.mockResolvedValue({ id: "tag-1", name: "inspo" });

    const result = await tagService.findOrCreate("user-1", "inspo");

    expect(tag.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "inspo" },
      select: { id: true, name: true },
    });
    expect(result).toEqual({ tag: { id: "tag-1", name: "inspo" }, created: true });
  });

  it("returns the existing tag on a unique constraint conflict instead of erroring", async () => {
    tag.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.0",
      }),
    );
    tag.findUniqueOrThrow.mockResolvedValue({ id: "tag-1", name: "inspo" });

    const result = await tagService.findOrCreate("user-1", "inspo");

    expect(tag.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { userId_name: { userId: "user-1", name: "inspo" } },
      select: { id: true, name: true },
    });
    expect(result).toEqual({ tag: { id: "tag-1", name: "inspo" }, created: false });
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    tag.create.mockRejectedValue(new Error("connection lost"));

    await expect(tagService.findOrCreate("user-1", "inspo")).rejects.toThrow("connection lost");
  });

  it("lists tags for the user with item counts", async () => {
    tag.findMany.mockResolvedValue([{ id: "tag-1", name: "inspo", _count: { items: 5 } }]);

    const result = await tagService.list("user-1");

    expect(tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result).toEqual([{ id: "tag-1", name: "inspo", itemCount: 5 }]);
  });

  it("deletes only the tag row, never touching items directly", async () => {
    tag.deleteMany.mockResolvedValue({ count: 1 });

    const result = await tagService.remove("user-1", "tag-1");

    expect(tag.deleteMany).toHaveBeenCalledWith({ where: { id: "tag-1", userId: "user-1" } });
    expect(result).toBe(true);
  });

  it("returns false when deleting a tag that doesn't exist or isn't owned by the user", async () => {
    tag.deleteMany.mockResolvedValue({ count: 0 });

    const result = await tagService.remove("user-1", "someone-elses-tag");

    expect(result).toBe(false);
  });
});

describe("TagService.rename", () => {
  beforeEach(() => {
    tag.findFirst.mockReset();
    tag.updateMany.mockReset();
  });

  it("renames a tag the user owns", async () => {
    tag.findFirst.mockResolvedValue(null);
    tag.updateMany.mockResolvedValue({ count: 1 });

    const result = await tagService.rename("user-1", "tag-1", "typography");

    expect(tag.updateMany).toHaveBeenCalledWith({
      where: { id: "tag-1", userId: "user-1" },
      data: { name: "typography" },
    });
    expect(result).toEqual({ status: "renamed", tag: { id: "tag-1", name: "typography" } });
  });

  it("reports a conflict instead of silently merging two tags", async () => {
    // Tag is unique on (userId, name). Folding them together is destructive
    // and is not what "rename" should do without saying so.
    tag.findFirst.mockResolvedValue({ id: "tag-2" });

    const result = await tagService.rename("user-1", "tag-1", "type");

    expect(result).toEqual({ status: "conflict" });
    expect(tag.updateMany).not.toHaveBeenCalled();
  });

  it("ignores the tag itself when checking for a conflict", async () => {
    tag.findFirst.mockResolvedValue(null);
    tag.updateMany.mockResolvedValue({ count: 1 });

    await tagService.rename("user-1", "tag-1", "type");

    expect(tag.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", name: "type", NOT: { id: "tag-1" } },
      select: { id: true },
    });
  });

  it("reports not-found for a tag belonging to someone else", async () => {
    tag.findFirst.mockResolvedValue(null);
    tag.updateMany.mockResolvedValue({ count: 0 });

    await expect(tagService.rename("user-1", "someone-elses", "type")).resolves.toEqual({
      status: "not-found",
    });
  });
});
