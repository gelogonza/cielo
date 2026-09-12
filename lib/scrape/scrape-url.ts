import { isIP } from "node:net";
import dns from "node:dns/promises";
import * as cheerio from "cheerio";
import { isPrivateIp } from "@/lib/scrape/is-private-ip";

export interface ScrapedMetadata {
  title: string | null;
  thumbnailUrl: string | null;
}

const FETCH_TIMEOUT_MS = 5000;
const BLOCKED_HOSTNAMES = new Set(["localhost"]);

async function isSafeToFetch(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (BLOCKED_HOSTNAMES.has(url.hostname)) {
    return false;
  }

  const addresses = isIP(url.hostname)
    ? [url.hostname]
    : (await dns.lookup(url.hostname, { all: true })).map((result) => result.address);

  return !addresses.some(isPrivateIp);
}

// Fetches og:title/og:image for the extension's Tier 2 fallback and manual
// link paste, when the client didn't already provide a thumbnail. Returns
// null on any failure — a save should never fail just because the source
// page couldn't be scraped.
export async function scrapeUrl(url: string): Promise<ScrapedMetadata | null> {
  try {
    const parsedUrl = new URL(url);

    if (!(await isSafeToFetch(parsedUrl))) {
      return null;
    }

    const response = await fetch(parsedUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CieloBot/1.0)" },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      null;

    // Plenty of sites publish no og:image at all — personal sites, portfolios
    // and docs especially — and a bookmark with no picture is a blank card in
    // a visual library. Fall back through the other conventions before giving
    // up, ending at the touch icon, which almost every site has.
    const thumbnailCandidate =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      largestIconHref($) ||
      null;

    return {
      title,
      // These values are frequently root-relative ("/og.png"); stored as-is
      // they render broken, so resolve against the page they came from.
      thumbnailUrl: toAbsolute(thumbnailCandidate, response.url || parsedUrl.href),
    };
  } catch {
    return null;
  }
}

/** Prefers an apple-touch-icon, then the icon declaring the largest size. */
function largestIconHref($: cheerio.CheerioAPI): string | null {
  const touch = $('link[rel~="apple-touch-icon"]').attr("href");

  if (touch) {
    return touch;
  }

  let best: { href: string; size: number } | null = null;

  $('link[rel~="icon"]').each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    // sizes can be "any", "32x32", or "48x48 32x32" — take the largest number.
    const size = Math.max(
      0,
      ...($(element).attr("sizes") ?? "")
        .split(/\s+/)
        .map((token) => Number.parseInt(token, 10))
        .filter((value) => Number.isFinite(value)),
    );

    if (!best || size > best.size) {
      best = { href, size };
    }
  });

  return best ? (best as { href: string }).href : null;
}

function toAbsolute(candidate: string | null, base: string): string | null {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, base).href;
  } catch {
    return null;
  }
}
