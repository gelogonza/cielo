const PLATFORM_HOSTNAMES = {
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "x.com": "x",
  "www.x.com": "x",
  "twitter.com": "x",
  "www.twitter.com": "x",
};

export function detectPlatform(hostname) {
  return PLATFORM_HOSTNAMES[hostname] ?? "web";
}

function metaContents(doc, property) {
  const selector = `meta[property="${property}"], meta[name="${property}"]`;
  return Array.from(doc.querySelectorAll(selector))
    .map((el) => el.getAttribute("content"))
    .filter((value) => Boolean(value));
}

// Extracts sharable metadata from the page's <head> using Open Graph /
// Twitter Card conventions — the same tags TikTok, Instagram, and X (and
// nearly every site) publish on public post pages so links preview nicely
// elsewhere. This is intentionally NOT based on each platform's rendered
// post DOM (React internals, obfuscated class names): that structure
// changes constantly and can't be verified without live inspection of the
// current page. og/twitter meta tags are a stable, documented convention.
//
// contentType is a best-effort classification, not load-bearing business
// logic — multiple og:image tags (the convention Instagram/X use for
// multi-image posts) map to CAROUSEL; an og:video tag maps to VIDEO; a
// single image on a known social platform maps to IMAGE; everything else
// defaults to LINK.
/**
 * @param {Document} doc
 * @param {string} hostname
 * @param {string | null} [pageUrl]
 */
export function extractMetadata(doc, hostname, pageUrl = null) {
  const platform = detectPlatform(hostname);

  // Prefer the page's own declared canonical URL over the address bar's,
  // so re-saving the same post with different tracking params (?utm_...)
  // resolves to the same url and hits the unique(userId, url) dedup path.
  const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
  const ogUrl = metaContents(doc, "og:url")[0] ?? null;
  const url = canonicalUrl || ogUrl || pageUrl;

  const ogImages = metaContents(doc, "og:image");
  const twitterImages = metaContents(doc, "twitter:image");
  const images = ogImages.length > 0 ? ogImages : twitterImages;

  const title =
    metaContents(doc, "og:title")[0] ??
    metaContents(doc, "twitter:title")[0] ??
    doc.querySelector("title")?.textContent ??
    null;

  const hasVideo = metaContents(doc, "og:video").length > 0;

  let contentType = "LINK";
  if (hasVideo) {
    contentType = "VIDEO";
  } else if (images.length > 1) {
    contentType = "CAROUSEL";
  } else if (images.length === 1 && platform !== "web") {
    contentType = "IMAGE";
  }

  return {
    title: title || null,
    thumbnailUrl: images[0] ?? null,
    contentType,
    sourcePlatform: platform,
    url,
  };
}
