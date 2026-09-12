import { prisma } from "@/lib/db";
import type { ContentType } from "@/lib/generated/prisma/client";
import { scrapeUrl } from "@/lib/scrape/scrape-url";
import { tagService } from "@/lib/tags/tag-service";

export interface SaveLinkInput {
  /** Null only for a highlight saved without a source page. */
  url: string | null;
  title: string | null;
  /** The captured text of a highlight; null for every other kind of save. */
  body?: string | null;
  thumbnailUrl: string | null;
  contentType: ContentType;
  sourcePlatform: string | null;
  sectionIds: string[];
  tagNames: string[];
}

export interface SaveLinkResult {
  item: Awaited<ReturnType<typeof loadWithRelations>>;
  reused: boolean;
}

export interface ListItemsInput {
  /** Omit for the computed "General" view (every item for this user). */
  sectionId?: string;
  tagId?: string;
  /** ISO savedAt of the last item on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface SearchItemsInput {
  q: string;
  cursor?: string;
  limit?: number;
}

export interface ListItemsResult {
  items: Awaited<ReturnType<typeof loadWithRelations>>[];
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

async function loadWithRelations(itemId: string) {
  return prisma.item.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      sections: { include: { section: { select: { id: true, name: true } } } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });
}

class ItemService {
  async saveLink(userId: string, input: SaveLinkInput): Promise<SaveLinkResult> {
    // A quote with no source has no url to dedup on, and Postgres treats NULL
    // as distinct under unique(user_id, url) — so each one is its own item.
    const existing = input.url
      ? await prisma.item.findUnique({
          where: { unique_user_url: { userId, url: input.url } },
        })
      : null;

    const itemId = existing ? existing.id : await this.createItem(userId, input);

    await this.attachSectionsAndTags(userId, itemId, input.sectionIds, input.tagNames);

    return { item: await loadWithRelations(itemId), reused: Boolean(existing) };
  }

  private async createItem(userId: string, input: SaveLinkInput): Promise<string> {
    let { title, thumbnailUrl } = input;

    // A highlight carries its own words and is rendered as a quote, so there
    // is nothing a scrape could add — skip the round-trip.
    if (input.url && !thumbnailUrl && input.contentType !== "TEXT") {
      const scraped = await scrapeUrl(input.url);
      title = title ?? scraped?.title ?? null;
      thumbnailUrl = thumbnailUrl ?? scraped?.thumbnailUrl ?? null;
    }

    const created = await prisma.item.create({
      data: {
        userId,
        url: input.url,
        title,
        body: input.body ?? null,
        thumbnailUrl,
        contentType: input.contentType,
        // Nothing was fetched from the web for a sourceless quote.
        sourceType: input.url ? "WEB" : "DIRECT",
        sourcePlatform: input.sourcePlatform,
      },
    });

    return created.id;
  }

  // sectionIds are client-supplied and must be re-checked against the
  // session's own sections here — otherwise a user could attach their item
  // to another user's section by guessing/knowing its id. Foreign ids are
  // silently dropped rather than erroring the whole save.
  private async attachSectionsAndTags(
    userId: string,
    itemId: string,
    sectionIds: string[],
    tagNames: string[],
  ): Promise<void> {
    if (sectionIds.length > 0) {
      const ownedSections = await prisma.section.findMany({
        where: { id: { in: sectionIds }, userId },
        select: { id: true },
      });

      if (ownedSections.length > 0) {
        await prisma.itemSection.createMany({
          data: ownedSections.map((section) => ({ itemId, sectionId: section.id })),
          skipDuplicates: true,
        });
      }
    }

    if (tagNames.length > 0) {
      const tags = await Promise.all(tagNames.map((name) => tagService.findOrCreate(userId, name)));

      await prisma.itemTag.createMany({
        data: tags.map(({ tag }) => ({ itemId, tagId: tag.id })),
        skipDuplicates: true,
      });
    }
  }

  // Newest-first cursor pagination. The cursor is the previous page's last
  // savedAt, per api-contract.md; items sharing an exact savedAt timestamp
  // can straddle a page boundary, which is acceptable at this precision.
  async list(userId: string, input: ListItemsInput = {}): Promise<ListItemsResult> {
    const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const rows = await prisma.item.findMany({
      where: {
        userId,
        ...(input.sectionId ? { sections: { some: { sectionId: input.sectionId } } } : {}),
        ...(input.tagId ? { tags: { some: { tagId: input.tagId } } } : {}),
        ...(input.cursor ? { savedAt: { lt: new Date(input.cursor) } } : {}),
      },
      orderBy: { savedAt: "desc" },
      // One extra row tells us whether another page exists without a count query.
      take: limit + 1,
      include: {
        sections: { include: { section: { select: { id: true, name: true } } } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].savedAt.toISOString() : null,
    };
  }

  /**
   * Full-text search across an item's own words, its tag names and its url.
   *
   * The tsvector column is invisible to the Prisma client, so matching ids come
   * from raw SQL and the rows themselves are then loaded through the client —
   * which keeps the relation loading and the wire shape identical to list().
   *
   * Results stay newest-first rather than ranked by relevance, so the cursor
   * contract is the same one /api/items uses.
   */
  async search(userId: string, input: SearchItemsInput): Promise<ListItemsResult> {
    const query = input.q.trim();
    const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    if (!query) {
      return { items: [], nextCursor: null };
    }

    const cursor = input.cursor ? new Date(input.cursor) : null;
    // ILIKE needs its own wildcards; the parameter is still bound, not spliced.
    const like = `%${query}%`;

    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id
      FROM items i
      WHERE i.user_id = ${userId}
        AND (${cursor}::timestamp IS NULL OR i.saved_at < ${cursor}::timestamp)
        AND (
          i.search_vector @@ websearch_to_tsquery('english', ${query})
          OR i.url ILIKE ${like}
          OR EXISTS (
            SELECT 1 FROM item_tags it
            JOIN tags t ON t.id = it.tag_id
            WHERE it.item_id = i.id AND t.name ILIKE ${like}
          )
        )
      ORDER BY i.saved_at DESC
      LIMIT ${limit + 1}
    `;

    if (matches.length === 0) {
      return { items: [], nextCursor: null };
    }

    const hasMore = matches.length > limit;
    const ids = (hasMore ? matches.slice(0, limit) : matches).map((row) => row.id);

    const rows = await prisma.item.findMany({
      where: { id: { in: ids } },
      orderBy: { savedAt: "desc" },
      include: {
        sections: { include: { section: { select: { id: true, name: true } } } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });

    return {
      items: rows,
      nextCursor: hasMore ? rows[rows.length - 1].savedAt.toISOString() : null,
    };
  }

  /** Total item count for the computed "General" view. */
  async countAll(userId: string): Promise<number> {
    return prisma.item.count({ where: { userId } });
  }

  async get(userId: string, itemId: string) {
    return prisma.item.findFirst({
      where: { id: itemId, userId },
      include: {
        sections: { include: { section: { select: { id: true, name: true } } } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        note: true,
      },
    });
  }

  async remove(userId: string, itemId: string): Promise<boolean> {
    const { count } = await prisma.item.deleteMany({ where: { id: itemId, userId } });
    return count > 0;
  }

  // Replace semantics: the supplied lists become the item's sections/tags, so
  // the detail panel can both attach and detach with one call. Omitting a list
  // leaves that dimension untouched.
  async setSectionsAndTags(
    userId: string,
    itemId: string,
    input: { sectionIds?: string[]; tagNames?: string[] },
  ) {
    const owned = await prisma.item.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });

    if (!owned) {
      return null;
    }

    if (input.sectionIds) {
      await prisma.itemSection.deleteMany({ where: { itemId } });
    }

    if (input.tagNames) {
      await prisma.itemTag.deleteMany({ where: { itemId } });
    }

    await this.attachSectionsAndTags(userId, itemId, input.sectionIds ?? [], input.tagNames ?? []);

    return loadWithRelations(itemId);
  }

  async setNote(userId: string, itemId: string, body: string) {
    const owned = await prisma.item.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });

    if (!owned) {
      return null;
    }

    return prisma.note.upsert({
      where: { itemId },
      create: { itemId, body },
      update: { body },
    });
  }

  async removeNote(userId: string, itemId: string): Promise<boolean> {
    const owned = await prisma.item.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });

    if (!owned) {
      return false;
    }

    const { count } = await prisma.note.deleteMany({ where: { itemId } });
    return count > 0;
  }
}

export const itemService = new ItemService();
