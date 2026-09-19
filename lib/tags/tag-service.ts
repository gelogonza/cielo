import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

export interface TagSummary {
  id: string;
  name: string;
  itemCount: number;
}

export type RenameTagResult =
  | { status: "renamed"; tag: { id: string; name: string } }
  | { status: "not-found" }
  /** The user already has a tag with that name. */
  | { status: "conflict" };

export interface FindOrCreateTagResult {
  tag: { id: string; name: string };
  created: boolean;
}

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

class TagService {
  // Optimistic create, falling back to a lookup on conflict, so two
  // concurrent requests for the same (userId, name) can't both pass a
  // check-then-create race — the @@unique constraint is the source of truth.
  async findOrCreate(userId: string, name: string): Promise<FindOrCreateTagResult> {
    try {
      const tag = await prisma.tag.create({
        data: { userId, name },
        select: { id: true, name: true },
      });
      return { tag, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const tag = await prisma.tag.findUniqueOrThrow({
          where: { userId_name: { userId, name } },
          select: { id: true, name: true },
        });
        return { tag, created: false };
      }

      throw error;
    }
  }

  async list(userId: string): Promise<TagSummary[]> {
    const tags = await prisma.tag.findMany({
      where: { userId },
      select: { id: true, name: true, _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });

    return tags.map((tag) => ({ id: tag.id, name: tag.name, itemCount: tag._count.items }));
  }

  /**
   * Renames a tag, or reports why it could not.
   *
   * `Tag` is unique on `(userId, name)`, so renaming onto a name the user
   * already has is a conflict rather than a merge. Folding two tags together
   * is a reasonable thing to want, but it is a different, destructive
   * operation — doing it silently under "rename" would lose a distinction the
   * user made without telling them.
   */
  async rename(userId: string, tagId: string, name: string): Promise<RenameTagResult> {
    const existing = await prisma.tag.findFirst({
      where: { userId, name, NOT: { id: tagId } },
      select: { id: true },
    });

    if (existing) {
      return { status: "conflict" };
    }

    const { count } = await prisma.tag.updateMany({
      where: { id: tagId, userId },
      data: { name },
    });

    return count > 0 ? { status: "renamed", tag: { id: tagId, name } } : { status: "not-found" };
  }

  // Deletes only the Tag row — ItemTag join rows cascade, Item rows are
  // untouched (same reasoning as SectionService.remove).
  async remove(userId: string, tagId: string): Promise<boolean> {
    const { count } = await prisma.tag.deleteMany({ where: { id: tagId, userId } });
    return count > 0;
  }
}

export const tagService = new TagService();
