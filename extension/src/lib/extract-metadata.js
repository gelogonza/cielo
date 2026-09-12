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
  // Only these drive contentType below — a favicon or an in-page photo says
  // nothing about whether the post is a carousel.
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

  // Many pages publish no og:image at all, which would leave a blank card in
  // the feed. Unlike the server scraper, a content script sees the rendered
  // page, so it can borrow a real image off the page before resorting to an
  // icon. Kept out of `images` so contentType is unaffected.
  const thumbnailCandidate = images[0] ?? largestContentImage(doc) ?? iconHref(doc) ?? null;

  return {
    // og:site_name lets the caller notice a "title" that is only the brand —
    // Pinterest serves `og:title: "Pinterest"` on every feed and pin page.
    siteName: metaContents(doc, "og:site_name")[0] ?? null,
    title: title || null,
    thumbnailUrl: toAbsolute(thumbnailCandidate, pageUrl ?? url),
    contentType,
    sourcePlatform: platform,
    url,
  };
}

/** Smallest edge a page image must have before it is worth using as a thumbnail. */
const MIN_IMAGE_EDGE = 200;

/**
 * Largest sufficiently big <img> on the page. Filters out spacers, tracking
 * pixels, icons and inline data URIs; picks by area so a hero image wins over
 * a row of small ones.
 *
 * @param {Document} doc
 */
function largestContentImage(doc) {
  let best = null;

  for (const image of Array.from(doc.images ?? [])) {
    const source = image.currentSrc || image.src;

    if (!source || source.startsWith("data:")) {
      continue;
    }

    // naturalWidth is 0 for images that have not decoded yet, so fall back to
    // the laid-out box and then the declared attributes.
    const width =
      image.naturalWidth || image.clientWidth || Number(image.getAttribute("width")) || 0;
    const height =
      image.naturalHeight || image.clientHeight || Number(image.getAttribute("height")) || 0;

    if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) {
      continue;
    }

    const area = width * height;

    if (!best || area > best.area) {
      best = { source, area };
    }
  }

  return best?.source ?? null;
}

/** Prefers an apple-touch-icon, then the icon declaring the largest size. */
function iconHref(doc) {
  const touch = doc.querySelector('link[rel~="apple-touch-icon"]');

  if (touch?.getAttribute("href")) {
    return touch.getAttribute("href");
  }

  let best = null;

  for (const link of Array.from(doc.querySelectorAll('link[rel~="icon"]'))) {
    const href = link.getAttribute("href");

    if (!href) {
      continue;
    }

    // sizes can be "any", "32x32", or "48x48 32x32" — take the largest number.
    const size = Math.max(
      0,
      ...(link.getAttribute("sizes") ?? "")
        .split(/\s+/)
        .map((token) => Number.parseInt(token, 10))
        .filter((value) => Number.isFinite(value)),
    );

    if (!best || size > best.size) {
      best = { href, size };
    }
  }

  return best?.href ?? null;
}

/**
 * og:image and icon hrefs are routinely root-relative; stored that way they
 * render broken once the feed shows them on another origin.
 *
 * @param {string | null} candidate
 * @param {string | null} base
 */
function toAbsolute(candidate, base) {
  if (!candidate) {
    return null;
  }

  try {
    return base ? new URL(candidate, base).href : candidate;
  } catch {
    return candidate;
  }
}
