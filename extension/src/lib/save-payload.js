/**
 * Builds the POST /api/save body for a right-click save. Which context the
 * user clicked decides what gets saved:
 *
 * - page      → the scraped page itself (og/twitter metadata from the content script)
 * - link      → the link's target, left for the server to scrape
 * - image     → the image itself, which is its own thumbnail
 * - selection → the highlighted text, saved as a quote (contentType TEXT)
 *
 * Returns null when there is nothing savable, so the caller can report a
 * useful message instead of POSTing a body with a null url.
 */
export const SAVE_CONTEXTS = ["page", "link", "image", "selection"];

/**
 * @typedef {object} ClickInfo
 * @property {string} [linkUrl] Target of a right-clicked link.
 * @property {string} [srcUrl] Source of a right-clicked image.
 * @property {string} [pageUrl] Page the click happened on.
 * @property {string} [selectionText] Chrome's copy of the selection — truncated.
 *
 * @typedef {object} PageMetadata
 * @property {string | null} [url]
 * @property {string | null} [title]
 * @property {string | null} [thumbnailUrl]
 * @property {string} [contentType]
 * @property {string} [sourcePlatform]
 * @property {string | null} [siteName]
 *
 * @param {object} input
 * @param {string} input.context One of SAVE_CONTEXTS.
 * @param {ClickInfo} [input.info]
 * @param {PageMetadata | null} [input.metadata]
 * @param {string | null} [input.defaultSectionId]
 * @param {string | null} [input.selectionText] Full selection, read from the page.
 * @param {string | null} [input.imageAlt] Description of the right-clicked image.
 */
export function buildSavePayload({
  context,
  info = {},
  metadata = null,
  defaultSectionId = null,
  selectionText = null,
  imageAlt = null,
}) {
  const sectionIds = defaultSectionId ? [defaultSectionId] : [];

  if (context === "selection") {
    // Chrome truncates info.selectionText, so the content script's reading of
    // the live selection is preferred and this is only the fallback.
    const quote = collapseWhitespace(selectionText || info.selectionText || "");
    const pageUrl = info.pageUrl ?? metadata?.url ?? null;

    if (!quote || !pageUrl) {
      return null;
    }

    return {
      // Every highlight from a page shares that page's url, which would collide
      // on unique(user_id, url). The text fragment makes each one distinct and
      // doubles as a deep link straight to the quote.
      url: buildHighlightUrl(pageUrl, quote),
      // The page title, so the quote card can say where it came from.
      title: metadata?.title ?? null,
      body: quote,
      thumbnailUrl: null,
      contentType: "TEXT",
      sourcePlatform: platformOf(pageUrl),
      sectionIds,
      tagNames: [],
    };
  }

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
          // The image's own alt beats the page title: on a feed every image
          // shares one title, and sites like Pinterest make that just the brand.
          title: imageAlt ?? usefulTitle(metadata),
          url: info.srcUrl,
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
    title: usefulTitle(metadata),
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

/**
 * Drops a "title" that is only the site's own name. Pinterest answers
 * `og:title: "Pinterest"` on every feed and pin page, and storing that is worse
 * than storing nothing — the card then shows the domain, which is at least true.
 *
 * @param {PageMetadata | null} metadata
 */
function usefulTitle(metadata) {
  const title = metadata?.title?.trim();

  if (!title) {
    return null;
  }

  const siteName = metadata?.siteName?.trim();
  return siteName && title.toLowerCase() === siteName.toLowerCase() ? null : title;
}

/** Longest quote embedded whole in a fragment before switching to start,end. */
const MAX_WHOLE_FRAGMENT = 200;
/** Characters taken from each end when a quote is too long to embed whole. */
const FRAGMENT_EDGE = 60;

/**
 * Builds a URL fragment directive (https://wicg.github.io/scroll-to-text-fragment)
 * naming the quote, so opening the saved item scrolls to and highlights it.
 *
 * @param {string} pageUrl
 * @param {string} quote
 */
export function buildHighlightUrl(pageUrl, quote) {
  const base = stripFragment(pageUrl);

  if (quote.length <= MAX_WHOLE_FRAGMENT) {
    return `${base}#:~:text=${encodeFragmentTerm(quote)}`;
  }

  // Too long to embed whole: the spec takes textStart,textEnd and highlights
  // everything between them, so a long quote still resolves to one range.
  const start = trimToWordBoundary(quote.slice(0, FRAGMENT_EDGE));
  const end = trimToWordBoundary(quote.slice(-FRAGMENT_EDGE), true);

  return `${base}#:~:text=${encodeFragmentTerm(start)},${encodeFragmentTerm(end)}`;
}

function stripFragment(url) {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * A fragment term must percent-encode "-", "," and "&" because they are
 * syntax. encodeURIComponent handles "," and "&" but leaves "-" alone.
 */
function encodeFragmentTerm(text) {
  return encodeURIComponent(text).replace(/-/g, "%2D");
}

/** Fragments match exact text, so a term cut mid-word would never resolve. */
function trimToWordBoundary(text, fromStart = false) {
  const trimmed = fromStart ? text.replace(/^\S*\s+/, "") : text.replace(/\s+\S*$/, "");
  return trimmed || text;
}

/** Selections carry the page's line wrapping; the quote should not. */
function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
