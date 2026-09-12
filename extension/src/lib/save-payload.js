/**
 * Builds the POST /api/save body for a right-click save. Which context the
 * user clicked decides what gets saved:
 *
 * - page  → the scraped page itself (og/twitter metadata from the content script)
 * - link  → the link's target, left for the server to scrape
 * - image → the image itself, which is its own thumbnail
 *
 * Returns null when there is nothing savable, so the caller can report a
 * useful message instead of POSTing a body with a null url.
 */
export const SAVE_CONTEXTS = ["page", "link", "image"];

/**
 * @typedef {object} ClickInfo
 * @property {string} [linkUrl] Target of a right-clicked link.
 * @property {string} [srcUrl] Source of a right-clicked image.
 * @property {string} [pageUrl] Page the click happened on.
 *
 * @typedef {object} PageMetadata
 * @property {string | null} [url]
 * @property {string | null} [title]
 * @property {string | null} [thumbnailUrl]
 * @property {string} [contentType]
 * @property {string} [sourcePlatform]
 *
 * @param {object} input
 * @param {string} input.context One of SAVE_CONTEXTS.
 * @param {ClickInfo} [input.info]
 * @param {PageMetadata | null} [input.metadata]
 * @param {string | null} [input.defaultSectionId]
 */
export function buildSavePayload({ context, info = {}, metadata = null, defaultSectionId = null }) {
  const sectionIds = defaultSectionId ? [defaultSectionId] : [];

  if (context === "link") {
    return info.linkUrl
      ? {
          url: info.linkUrl,
          // The link's text is the anchor's label, not the target page's
          // title, so it is left null and the server scrapes the real one.
          title: null,
          thumbnailUrl: null,
          contentType: "LINK",
          sourcePlatform: platformOf(info.linkUrl),
          sectionIds,
          tagNames: [],
        }
      : null;
  }

  if (context === "image") {
    return info.srcUrl
      ? {
          url: info.srcUrl,
          title: metadata?.title ?? null,
          thumbnailUrl: info.srcUrl,
          contentType: "IMAGE",
          sourcePlatform: platformOf(info.pageUrl ?? info.srcUrl),
          sectionIds,
          tagNames: [],
        }
      : null;
  }

  if (!metadata?.url) {
    return null;
  }

  return {
    url: metadata.url,
    title: metadata.title ?? null,
    thumbnailUrl: metadata.thumbnailUrl ?? null,
    contentType: metadata.contentType ?? "LINK",
    sourcePlatform: metadata.sourcePlatform ?? "web",
    sectionIds,
    tagNames: [],
  };
}

/**
 * Duplicated from lib/items/platform.ts — the extension ships standalone.
 * @param {string} url
 */
function platformOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");

    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "x.com" || host === "twitter.com") return "x";
    return "web";
  } catch {
    return "web";
  }
}
