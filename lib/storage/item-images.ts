/**
 * Where a directly-uploaded image lives, and what counts as one.
 *
 * Shared by the browser (which does the upload) and the server (which checks
 * the key it is handed), so the two cannot drift about what a valid object
 * looks like. See prisma/manual-sql/009_item_images_bucket.sql for the bucket
 * and the policies that enforce the same shape in the database.
 */
export const ITEM_IMAGES_BUCKET = "item-images";

/** Matches the bucket's own `file_size_limit`. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Deliberately no `image/svg+xml`. An SVG is a document that can carry script,
 * and these are served back from our own origin — a stored XSS waiting to
 * happen, for a format nobody needs to bookmark.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * `<user id>/<uuid>.<ext>` — the first segment is what every storage policy
 * keys off, so it has to be the owner and nothing else.
 *
 * The original filename is deliberately dropped. It carries no meaning Cielo
 * uses, and people's filenames say more about them than they realise.
 */
export function objectKeyFor(userId: string, mimeType: string, id = crypto.randomUUID()): string {
  return `${userId}/${id}.${EXTENSIONS[mimeType] ?? "bin"}`;
}

/**
 * True when this key belongs to this user.
 *
 * The storage policies already enforce it, but the confirm step takes the key
 * from the request body — so without this, a crafted body could attach an
 * item to a path the caller does not own. Checked here as well as there,
 * because the row and the object are written by two different systems.
 */
export function ownsObjectKey(userId: string, key: string): boolean {
  const segments = key.split("/");

  return (
    segments.length === 2 &&
    segments[0] === userId &&
    segments[1].length > 0 &&
    // No traversal, no nesting, no hidden files.
    !segments[1].startsWith(".") &&
    !key.includes("..")
  );
}

/** The stable, session-checked URL the feed renders for an uploaded image. */
export function itemImageUrl(itemId: string): string {
  return `/api/items/${itemId}/image`;
}
