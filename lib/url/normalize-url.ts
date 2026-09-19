/**
 * The one place a URL is turned into the form Cielo stores and dedupes on.
 *
 * `unique(user_id, url)` makes the stored string the identity of an item, so
 * two spellings of the same address are two rows. Saves used to store whatever
 * they were handed while imports ran every href through `new URL().href` —
 * which meant `https://x.com` and `https://x.com/` were different items, and
 * re-importing your own export could duplicate your library.
 *
 * `URL.href` is the normal form: lowercased scheme and host, default port
 * dropped, empty path written as "/", and percent-encoding made consistent.
 * It is idempotent, which is what lets it be applied to rows that were saved
 * before it existed.
 *
 * What it deliberately does NOT do is strip anything. The query string can be
 * the whole address (`?v=…`), and the `#:~:text=` fragment is what makes two
 * highlights from one page two items rather than one — see the comment on
 * `unique_user_url` in prisma/schema.prisma.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Exports are full of javascript: bookmarklets and place: smart folders, and
  // nothing else is a thing Cielo could ever open or scrape.
  return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
}
