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

    const title = $('meta[property="og:title"]').attr("content") || $("title").text() || null;
    const thumbnailUrl = $('meta[property="og:image"]').attr("content") || null;

    return { title, thumbnailUrl };
  } catch {
    return null;
  }
}
