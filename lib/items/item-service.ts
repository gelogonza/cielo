import { prisma } from "@/lib/db";
import type { ContentType } from "@/lib/generated/prisma/client";
import { scrapeUrl } from "@/lib/scrape/scrape-url";
import { tagService } from "@/lib/tags/tag-service";

export interface SaveLinkInput {
  url: string;
  title: string | null;
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
    const existing = await prisma.item.findUnique({
      where: { unique_user_url: { userId, url: input.url } },
    });

    const itemId = existing ? existing.id : await this.createItem(userId, input);

    await this.attachSectionsAndTags(userId, itemId, input.sectionIds, input.tagNames);

    return { item: await loadWithRelations(itemId), reused: Boolean(existing) };
  }

  private async createItem(userId: string, input: SaveLinkInput): Promise<string> {
    let { title, thumbnailUrl } = input;

    if (!thumbnailUrl) {
      const scraped = await scrapeUrl(input.url);
      title = title ?? scraped?.title ?? null;
      thumbnailUrl = thumbnailUrl ?? scraped?.thumbnailUrl ?? null;
    }

    const created = await prisma.item.create({
      data: {
        userId,
        url: input.url,
        title,
        thumbnailUrl,
        contentType: input.contentType,
        sourceType: "WEB",
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
}

export const itemService = new ItemService();
