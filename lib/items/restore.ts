import type { ContentType, SourceType } from "@/lib/generated/prisma/client";

/**
 * Everything needed to put a deleted item back exactly as it was.
 *
 * Deliberately not `SerializedItem`: the wire shape is what the feed renders,
 * and it drops the two things an undo cannot do without — `importBatch` (so an
 * import's undo still knows which rows it created) and the note. It also
 * carries section and tag **ids** rather than names, because restoring must
 * reattach the item to the sections it was in, not create new ones.
 *
 * A bulk delete hands this straight back to the client, which holds it for as
 * long as the undo is on screen. That keeps undo entirely stateless on the
 * server: nothing to expire, nothing to sweep up, and the offer disappears
 * exactly when the thing backing it does.
 */
export interface RestorableItem {
  id: string;
  url: string | null;
  title: string | null;
  body: string | null;
  thumbnailUrl: string | null;
  contentType: ContentType;
  sourceType: SourceType;
  sourcePlatform: string | null;
  savedAt: string;
  importBatch: string | null;
  sectionIds: string[];
  tagIds: string[];
  note: string | null;
}

interface DeletedRow {
  id: string;
  url: string | null;
  title: string | null;
  body: string | null;
  thumbnailUrl: string | null;
  contentType: ContentType;
  sourceType: SourceType;
  sourcePlatform: string | null;
  savedAt: Date;
  importBatch: string | null;
  sections: { sectionId: string }[];
  tags: { tagId: string }[];
  note: { body: string } | null;
}

export function toRestorable(row: DeletedRow): RestorableItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    body: row.body,
    thumbnailUrl: row.thumbnailUrl,
    contentType: row.contentType,
    sourceType: row.sourceType,
    sourcePlatform: row.sourcePlatform,
    savedAt: row.savedAt.toISOString(),
    importBatch: row.importBatch,
    sectionIds: row.sections.map(({ sectionId }) => sectionId),
    tagIds: row.tags.map(({ tagId }) => tagId),
    note: row.note?.body ?? null,
  };
}
