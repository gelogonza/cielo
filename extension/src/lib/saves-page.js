/**
 * Reads a platform's own "saved" page from inside the user's logged-in
 * browser. There is no API route to this data — Instagram's Graph API does not
 * expose saved posts and TikTok's does not expose favourites — but the page
 * itself is right there in the session the user already has.
 *
 * Deliberately matches **link shapes**, not post markup. These sites re-skin
 * constantly and their class names are generated, but `/p/<id>` and
 * `/video/<id>` have been stable for years.
 */

/** @typedef {{ platform: string, label: string, section: string, page: RegExp, link: RegExp }} SavesPage */

/** @type {SavesPage[]} */
export const SAVES_PAGES = [
  {
    platform: "instagram",
    label: "Instagram saves",
    section: "Instagram saves",
    page: /^https:\/\/(www\.)?instagram\.com\/[^/]+\/saved(\/|$|\?)/i,
    link: /^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/i,
  },
  {
    platform: "tiktok",
    label: "TikTok favourites",
    section: "TikTok favourites",
    // TikTok keeps the Favourites tab client-side, so the profile URL is as
    // specific as it gets; whatever videos are on screen are what we collect.
    page: /^https:\/\/(www\.)?tiktok\.com\/@[^/]+/i,
    link: /^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/i,
  },
  {
    platform: "x",
    label: "X bookmarks",
    section: "X bookmarks",
    page: /^https:\/\/(x|twitter)\.com\/i\/bookmarks/i,
    link: /^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/i,
  },
];

/**
 * @param {string} url
 * @returns {SavesPage | null}
 */
export function detectSavesPage(url) {
  if (!url) {
    return null;
  }

  return SAVES_PAGES.find((candidate) => candidate.page.test(url)) ?? null;
}

/**
 * Every saved post linked from the current page, with the thumbnail the page
 * already rendered.
 *
 * @param {Document} doc
 * @param {SavesPage} config
 * @param {string} baseUrl
 */
export function collectSavedLinks(doc, config, baseUrl) {
  /** @type {Map<string, { url: string, title: string | null, thumbnailUrl: string | null }>} */
  const found = new Map();

  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = absolute(anchor.getAttribute("href"), baseUrl);

    if (!href || !config.link.test(href)) {
      continue;
    }

    // Strip query strings: the same post is linked with different tracking
    // params in different places on these pages.
    const url = href.split("?")[0];

    if (found.has(url)) {
      continue;
    }

    const image = anchor.querySelector("img");

    found.set(url, {
      url,
      // On a grid the alt text is the post's own description.
      title: image?.getAttribute("alt")?.trim() || null,
      thumbnailUrl: image?.getAttribute("src") || null,
    });
  }

  return [...found.values()];
}

function absolute(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}
