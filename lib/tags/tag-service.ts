import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

export interface TagSummary {
  id: string;
  name: string;
  itemCount: number;
}

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

  // Deletes only the Tag row — ItemTag join rows cascade, Item rows are
  // untouched (same reasoning as SectionService.remove).
  async remove(userId: string, tagId: string): Promise<boolean> {
    const { count } = await prisma.tag.deleteMany({ where: { id: tagId, userId } });
    return count > 0;
  }
}

export const tagService = new TagService();
