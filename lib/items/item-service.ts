import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ContentType } from "@/lib/generated/prisma/client";
import { detectPlatform } from "@/lib/items/platform";
import { scrapeUrl } from "@/lib/scrape/scrape-url";
import { tagService } from "@/lib/tags/tag-service";
import { normalizeUrl } from "@/lib/url/normalize-url";

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

export interface ImportEntry {
  url: string;
  title: string | null;
  /** Folder from the export; becomes a section of the same name. */
  folder: string | null;
  tags: string[];
  savedAt: string | null;
  /**
   * Only the extension can supply this — a logged-in saves page renders
   * thumbnails the server has no way to fetch. Note these are signed CDN URLs
   * on Instagram and TikTok and will expire; see docs/devlog.md.
   */
  thumbnailUrl?: string | null;
}

export interface ImportResult {
  imported: number;
  /** Already in the library — left untouched rather than duplicated. */
  reused: number;
  sectionsCreated: number;
  /** Identifies everything this run created, so it can be undone. */
  batchId: string;
}

export interface UndoImportResult {
  itemsRemoved: number;
  sectionsRemoved: number;
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
    // The stored url is the item's identity under unique(user_id, url), so it
    // is normalized here rather than at each caller. Routes reject a url that
    // cannot be normalized; the fallback only covers a caller that did not,
    // because turning a link into a sourceless item would be worse than
    // storing an odd string.
    const url = input.url ? (normalizeUrl(input.url) ?? input.url) : null;

    // A quote with no source has no url to dedup on, and Postgres treats NULL
    // as distinct under unique(user_id, url) — so each one is its own item.
    const existing = url
      ? await prisma.item.findUnique({
          where: { unique_user_url: { userId, url } },
        })
      : null;

    const itemId = existing ? existing.id : await this.createItem(userId, { ...input, url });

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

  /**
   * Bulk import from an exported bookmark file.
   *
   * Set-based on purpose: a per-item round trip would take minutes on a real
   * export of a few thousand bookmarks. Each batch resolves its sections and
   * tags once, then writes items and join rows with createMany.
   *
   * Nothing is scraped — thousands of fetches would be slow and rude to the
   * sites involved. Imported items land with no thumbnail, which is exactly
   * what `npm run backfill:thumbnails` is for.
   */
  async importMany(userId: string, entries: ImportEntry[]): Promise<ImportResult> {
    const batchId = randomUUID();

    if (entries.length === 0) {
      return { imported: 0, reused: 0, sectionsCreated: 0, batchId };
    }

    // Later duplicates within one file lose to the first; unique(user_id, url)
    // would reject them anyway. Normalizing first means two spellings of one
    // address collapse here rather than becoming two rows — and that an entry
    // matches an item that was saved with the other spelling.
    const byUrl = new Map<string, ImportEntry>();
    for (const entry of entries) {
      const url = normalizeUrl(entry.url);

      if (url && !byUrl.has(url)) {
        byUrl.set(url, { ...entry, url });
      }
    }
    const unique = [...byUrl.values()];
    const urls = [...byUrl.keys()];

    // Every entry was junk — a javascript: bookmarklet, a place: smart folder.
    // Stop before creating sections for an import that files nothing.
    if (unique.length === 0) {
      return { imported: 0, reused: 0, sectionsCreated: 0, batchId };
    }

    const sectionIdByName = await this.resolveSectionsByName(
      userId,
      unique.map((entry) => entry.folder),
      batchId,
    );
    const sectionsBefore = sectionIdByName.createdCount;

    const tagIdByName = await this.resolveTagsByName(
      userId,
      unique.flatMap((entry) => entry.tags),
    );

    const existing = await prisma.item.findMany({
      where: { userId, url: { in: urls } },
      select: { id: true, url: true },
    });
    const existingUrls = new Set(existing.map((item) => item.url));

    const fresh = unique.filter((entry) => !existingUrls.has(entry.url));

    if (fresh.length > 0) {
      await prisma.item.createMany({
        data: fresh.map((entry) => ({
          userId,
          url: entry.url,
          title: entry.title,
          thumbnailUrl: entry.thumbnailUrl ?? null,
          contentType: "LINK" as const,
          sourceType: "WEB" as const,
          sourcePlatform: detectPlatform(entry.url),
          importBatch: batchId,
          // Keep the original save time so the feed's order reflects when the
          // user actually saved things, not when they migrated.
          ...(entry.savedAt ? { savedAt: new Date(entry.savedAt) } : {}),
        })),
        skipDuplicates: true,
      });
    }

    // Read ids back for the whole batch — createMany does not return them.
    const saved = await prisma.item.findMany({
      where: { userId, url: { in: urls } },
      select: { id: true, url: true },
    });
    const idByUrl = new Map(saved.map((item) => [item.url, item.id]));

    const sectionLinks: { itemId: string; sectionId: string }[] = [];
    const tagLinks: { itemId: string; tagId: string }[] = [];

    for (const entry of unique) {
      const itemId = idByUrl.get(entry.url);

      if (!itemId) {
        continue;
      }

      const sectionId = entry.folder ? sectionIdByName.ids.get(entry.folder) : undefined;

      if (sectionId) {
        sectionLinks.push({ itemId, sectionId });
      }

      for (const tag of entry.tags) {
        const tagId = tagIdByName.get(tag);
        if (tagId) {
          tagLinks.push({ itemId, tagId });
        }
      }
    }

    if (sectionLinks.length > 0) {
      await prisma.itemSection.createMany({ data: sectionLinks, skipDuplicates: true });
    }

    if (tagLinks.length > 0) {
      await prisma.itemTag.createMany({ data: tagLinks, skipDuplicates: true });
    }

    return {
      imported: fresh.length,
      reused: unique.length - fresh.length,
      sectionsCreated: sectionsBefore,
      batchId,
    };
  }

  /**
   * Reverses one import. Only rows that import created carry its batch id, so
   * a bookmark that was already in the library is never touched — and a
   * section it created is removed only if nothing is left in it, in case the
   * user has since filed something there by hand.
   */
  async undoImport(userId: string, batchId: string): Promise<UndoImportResult> {
    const { count: itemsRemoved } = await prisma.item.deleteMany({
      where: { userId, importBatch: batchId },
    });

    const created = await prisma.section.findMany({
      where: { userId, importBatch: batchId },
      select: { id: true, _count: { select: { items: true } } },
    });

    const emptied = created.filter((section) => section._count.items === 0);

    const { count: sectionsRemoved } = emptied.length
      ? await prisma.section.deleteMany({ where: { id: { in: emptied.map((s) => s.id) } } })
      : { count: 0 };

    return { itemsRemoved, sectionsRemoved };
  }

  /** Bulk delete, scoped to the owner so stray ids cannot reach another user. */
  async removeMany(userId: string, itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) {
      return 0;
    }

    const { count } = await prisma.item.deleteMany({
      where: { userId, id: { in: itemIds } },
    });

    return count;
  }

  /** Find-or-create every folder name in one pass, returning name → id. */
  private async resolveSectionsByName(userId: string, folders: (string | null)[], batchId: string) {
    const names = [...new Set(folders.filter((name): name is string => Boolean(name)))];

    if (names.length === 0) {
      return { ids: new Map<string, string>(), createdCount: 0 };
    }

    const existing = await prisma.section.findMany({
      where: { userId, name: { in: names } },
      select: { id: true, name: true },
    });
    const existingNames = new Set(existing.map((section) => section.name));
    const missing = names.filter((name) => !existingNames.has(name));

    if (missing.length > 0) {
      await prisma.section.createMany({
        data: missing.map((name) => ({ userId, name, importBatch: batchId })),
        skipDuplicates: true,
      });
    }

    const all = await prisma.section.findMany({
      where: { userId, name: { in: names } },
      select: { id: true, name: true },
    });

    return {
      ids: new Map(all.map((section) => [section.name, section.id])),
      createdCount: missing.length,
    };
  }

  /** Same shape for tags, which have a unique(userId, name) to lean on. */
  private async resolveTagsByName(userId: string, tagNames: string[]) {
    const names = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];

    if (names.length === 0) {
      return new Map<string, string>();
    }

    await prisma.tag.createMany({
      data: names.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });

    const all = await prisma.tag.findMany({
      where: { userId, name: { in: names } },
      select: { id: true, name: true },
    });

    return new Map(all.map((tag) => [tag.name, tag.id]));
  }

  /** Total item count for the computed "General" view. */
  async countAll(userId: string): Promise<number> {
    return prisma.item.count({ where: { userId } });
  }

  /**
   * Every item the user has, with everything attached to it, oldest last.
   *
   * Deliberately unpaginated: this backs the export, and an export that stops
   * at a page boundary is not an export. Notes are included here and nowhere
   * else in a list query, because the JSON export is meant to be lossless.
   */
  async exportAll(userId: string) {
    return prisma.item.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      include: {
        sections: { include: { section: { select: { id: true, name: true } } } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        note: { select: { body: true } },
      },
    });
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
