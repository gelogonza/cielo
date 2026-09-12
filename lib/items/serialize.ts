import type { ContentType, SourceType } from "@/lib/generated/prisma/client";

interface ItemWithRelations {
  id: string;
  url: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  contentType: ContentType;
  sourceType: SourceType;
  sourcePlatform: string | null;
  savedAt: Date;
  sections: { section: { id: string; name: string } }[];
  tags: { tag: { id: string; name: string } }[];
  note?: { body: string } | null;
}

export interface SerializedItem {
  id: string;
  url: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  contentType: ContentType;
  sourceType: SourceType;
  sourcePlatform: string | null;
  savedAt: string;
  sections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  note?: string | null;
}

/** The wire shape defined by docs/api-contract.md for GET /api/items. */
export function serializeItem(item: ItemWithRelations): SerializedItem {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    contentType: item.contentType,
    sourceType: item.sourceType,
    sourcePlatform: item.sourcePlatform,
    savedAt: item.savedAt.toISOString(),
    sections: item.sections.map(({ section }) => section),
    tags: item.tags.map(({ tag }) => tag),
    ...(item.note !== undefined ? { note: item.note?.body ?? null } : {}),
  };
}
