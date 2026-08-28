import { beforeEach, describe, expect, it, vi } from "vitest";

const section = {
  create: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({ prisma: { section } }));

const { sectionService } = await import("@/lib/sections/section-service");

describe("SectionService", () => {
  beforeEach(() => {
    section.create.mockReset();
    section.findMany.mockReset();
    section.updateMany.mockReset();
    section.deleteMany.mockReset();
  });

  it("creates a section scoped to the user", async () => {
    section.create.mockResolvedValue({
      id: "section-1",
      name: "Design",
      createdAt: new Date("2026-01-01"),
    });

    const result = await sectionService.create("user-1", "Design");

    expect(section.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Design" },
      select: { id: true, name: true, createdAt: true },
    });
    expect(result).toEqual({
      id: "section-1",
      name: "Design",
      createdAt: new Date("2026-01-01"),
    });
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
    section.updateMany.mockResolvedValue({ count: 1 });

    const result = await sectionService.rename("user-1", "section-1", "New name");

    expect(section.updateMany).toHaveBeenCalledWith({
      where: { id: "section-1", userId: "user-1" },
      data: { name: "New name" },
    });
    expect(result).toEqual({ id: "section-1", name: "New name" });
  });

  it("returns null when renaming a section that doesn't exist or isn't owned by the user", async () => {
    section.updateMany.mockResolvedValue({ count: 0 });

    const result = await sectionService.rename("user-1", "someone-elses-section", "New name");

    expect(result).toBeNull();
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
