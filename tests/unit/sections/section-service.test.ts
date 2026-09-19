import { beforeEach, describe, expect, it, vi } from "vitest";

const section = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findFirstOrThrow: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: { section } }));

const { Prisma } = await import("@/lib/generated/prisma/client");
const { sectionService } = await import("@/lib/sections/section-service");

describe("SectionService", () => {
  beforeEach(() => {
    section.create.mockReset();
    section.findFirst.mockReset();
    section.findFirstOrThrow.mockReset();
    section.findMany.mockReset();
    section.updateMany.mockReset();
    section.deleteMany.mockReset();
  });

  const created = { id: "section-1", name: "Design", createdAt: new Date("2026-01-01") };

  it("creates a section scoped to the user", async () => {
    section.findFirst.mockResolvedValue(null);
    section.create.mockResolvedValue(created);

    const result = await sectionService.create("user-1", "Design");

    expect(section.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Design" },
      select: { id: true, name: true, createdAt: true },
    });
    expect(result).toEqual({ section: created, created: true });
  });

  it("hands back the existing section instead of making a second with that name", async () => {
    section.findFirst.mockResolvedValue(created);

    const result = await sectionService.create("user-1", "Design");

    expect(result).toEqual({ section: created, created: false });
    expect(section.create).not.toHaveBeenCalled();
  });

  it("survives losing the race to another request with the same name", async () => {
    // The lookup said no, the constraint said yes — see 008.
    section.findFirst.mockResolvedValue(null);
    section.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    section.findFirstOrThrow.mockResolvedValue(created);

    await expect(sectionService.create("user-1", "Design")).resolves.toEqual({
      section: created,
      created: false,
    });
  });

  it("does not swallow an unrelated create failure", async () => {
    section.findFirst.mockResolvedValue(null);
    section.create.mockRejectedValue(new Error("connection lost"));

    await expect(sectionService.create("user-1", "Design")).rejects.toThrow("connection lost");
  });

  it("lists sections for the user with item counts", async () => {
    section.findMany.mockResolvedValue([
      { id: "section-1", name: "Design", _count: { items: 3 } },
      { id: "section-2", name: "Reading", _count: { items: 0 } },
    ]);

    const result = await sectionService.list("user-1");

    expect(section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result).toEqual([
      { id: "section-1", name: "Design", itemCount: 3 },
      { id: "section-2", name: "Reading", itemCount: 0 },
    ]);
  });

  it("renames a section owned by the user", async () => {
    section.findFirst.mockResolvedValue(null);
    section.updateMany.mockResolvedValue({ count: 1 });

    const result = await sectionService.rename("user-1", "section-1", "New name");

    expect(section.updateMany).toHaveBeenCalledWith({
      where: { id: "section-1", userId: "user-1" },
      data: { name: "New name" },
    });
    expect(result).toEqual({ status: "renamed", section: { id: "section-1", name: "New name" } });
  });

  it("reports a conflict instead of silently merging two sections", async () => {
    section.findFirst.mockResolvedValue({ id: "section-2" });

    const result = await sectionService.rename("user-1", "section-1", "Design");

    expect(result).toEqual({ status: "conflict" });
    expect(section.updateMany).not.toHaveBeenCalled();
  });

  it("ignores the section itself when checking for a conflict", async () => {
    section.findFirst.mockResolvedValue(null);
    section.updateMany.mockResolvedValue({ count: 1 });

    await sectionService.rename("user-1", "section-1", "Design");

    expect(section.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", name: "Design", NOT: { id: "section-1" } },
      select: { id: true },
    });
  });

  it("reports not-found for a section that isn't this user's", async () => {
    section.findFirst.mockResolvedValue(null);
    section.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      sectionService.rename("user-1", "someone-elses-section", "New name"),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("deletes only the section row, never touching items directly", async () => {
    section.deleteMany.mockResolvedValue({ count: 1 });

    const result = await sectionService.remove("user-1", "section-1");

    expect(section.deleteMany).toHaveBeenCalledWith({
      where: { id: "section-1", userId: "user-1" },
    });
    expect(result).toBe(true);
  });

  it("returns false when deleting a section that doesn't exist or isn't owned by the user", async () => {
    section.deleteMany.mockResolvedValue({ count: 0 });

    const result = await sectionService.remove("user-1", "someone-elses-section");

    expect(result).toBe(false);
  });
});
