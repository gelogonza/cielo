import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export interface FindOrCreateSectionResult {
  section: { id: string; name: string; createdAt: Date };
  created: boolean;
}

export type RenameSectionResult =
  | { status: "renamed"; section: { id: string; name: string } }
  | { status: "not-found" }
  /** The user already has a section with that name. */
  | { status: "conflict" };

export interface SectionSummary {
  id: string;
  name: string;
  itemCount: number;
}

class SectionService {
  /**
   * Find-or-create, the way tags have always worked.
   *
   * Two checks on purpose. The lookup is what makes typing an existing name
   * reuse that section rather than making a second one — and it is the only
   * thing that works until `prisma/manual-sql/008_section_name_unique.sql` has
   * been applied. The P2002 catch is what closes the race the lookup cannot,
   * once the constraint is there.
   */
  async create(userId: string, name: string): Promise<FindOrCreateSectionResult> {
    const existing = await prisma.section.findFirst({
      where: { userId, name },
      select: { id: true, name: true, createdAt: true },
    });

    if (existing) {
      return { section: existing, created: false };
    }

    try {
      const section = await prisma.section.create({
        data: { userId, name },
        select: { id: true, name: true, createdAt: true },
      });
      return { section, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const section = await prisma.section.findFirstOrThrow({
          where: { userId, name },
          select: { id: true, name: true, createdAt: true },
        });
        return { section, created: false };
      }

      throw error;
    }
  }

  async list(userId: string): Promise<SectionSummary[]> {
    const sections = await prisma.section.findMany({
      where: { userId },
      select: { id: true, name: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "asc" },
    });

    return sections.map((section) => ({
      id: section.id,
      name: section.name,
      itemCount: section._count.items,
    }));
  }

  /**
   * Renames a section, or reports why it could not. Same shape and same
   * reasoning as TagService.rename: renaming onto a name the user already has
   * is a conflict, not a silent merge.
   */
  async rename(userId: string, sectionId: string, name: string): Promise<RenameSectionResult> {
    const existing = await prisma.section.findFirst({
      where: { userId, name, NOT: { id: sectionId } },
      select: { id: true },
    });

    if (existing) {
      return { status: "conflict" };
    }

    const { count } = await prisma.section.updateMany({
      where: { id: sectionId, userId },
      data: { name },
    });

    return count > 0
      ? { status: "renamed", section: { id: sectionId, name } }
      : { status: "not-found" };
  }

  // Deletes the Section row itself. onDelete: Cascade on ItemSection's
  // section relation cleans up the join rows, but Item rows have no
  // cascade path from Section, so they stay untouched and remain visible
  // in the computed "General" view (all items for user_id, no join row).
  async remove(userId: string, sectionId: string): Promise<boolean> {
    const { count } = await prisma.section.deleteMany({
      where: { id: sectionId, userId },
    });

    return count > 0;
  }
}

export const sectionService = new SectionService();
