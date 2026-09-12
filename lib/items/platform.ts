/**
 * Source-platform helpers shared by the feed UI, the save dialog, and the
 * extension. Mirrors Item.sourcePlatform: a null platform means a direct
 * upload, which has no originating site.
 */
export type SourcePlatform = "web" | "instagram" | "tiktok" | "x" | "upload";

/** Maps a stored Item.sourcePlatform onto the badge variants in the design. */
export function toSourcePlatform(sourcePlatform: string | null): SourcePlatform {
  switch (sourcePlatform) {
    case "instagram":
    case "tiktok":
    case "x":
      return sourcePlatform;
    case "web":
      return "web";
    default:
      return "upload";
  }
}

/**
 * Classifies a URL the user pasted, so a web save carries the same platform
 * value the extension would have sent from that page.
 */
export function detectPlatform(url: string): "tiktok" | "instagram" | "x" | "web" {
  const host = hostnameOf(url);

  if (!host) return "web";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "x.com" || host === "twitter.com") return "x";
  return "web";
}

/** Host shown under the title on hover, e.g. "tiktok.com". */
export function sourceLabel(url: string | null): string | null {
  return url ? hostnameOf(url) : null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
