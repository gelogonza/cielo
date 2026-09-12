import { extractMetadata } from "./lib/extract-metadata.js";
import { collectSavedLinks, detectSavesPage } from "./lib/saves-page.js";

// Passive until asked: this script is injected on every page (per the
// manifest's static content_scripts declaration, matching the plan's
// locked `<all_urls>` permission), but does nothing until the background
// script's context-menu handler asks it to scrape — there's no on-page UI.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "COLLECT_SAVES") {
    // Async: the reply comes after scrolling finishes, so keep the channel open.
    collectSaves().then(sendResponse);
    return true;
  }

  if (message?.type !== "SCRAPE_PAGE") {
    return false;
  }

  try {
    const metadata = extractMetadata(document, location.hostname, location.href);
    // Read here rather than trusting info.selectionText, which Chrome
    // truncates — a saved quote should be the whole highlight.
    const selectionText = window.getSelection()?.toString() ?? "";
    // An image's own alt text describes it far better than the page title —
    // on a feed page every image shares one useless title.
    const imageAlt = message.srcUrl ? findImageDescription(message.srcUrl) : null;
    sendResponse({ ok: true, metadata, selectionText, imageAlt });
  } catch (error) {
    sendResponse({ ok: false, error: String(error) });
  }

  return false;
});

/**
 * The alt (or title) of the image the user right-clicked, matched by source.
 *
 * @param {string} srcUrl
 */
function findImageDescription(srcUrl) {
  for (const image of Array.from(document.images)) {
    if (image.currentSrc === srcUrl || image.src === srcUrl) {
      const description = (image.alt || image.title || "").trim();
      return description || null;
    }
  }

  return null;
}

/** Give a lazy grid time to render after each scroll. */
const SCROLL_SETTLE_MS = 900;
/** Stop after this many scrolls that reveal nothing new. */
const IDLE_SCROLLS = 3;
/** Hard ceiling, so a bottomless feed cannot run forever. */
const MAX_SCROLLS = 150;

/**
 * Walks the current saves page to the end, collecting every post it reveals.
 *
 * These grids are virtualised: items are removed from the DOM as they scroll
 * out of view, so links are accumulated as we go rather than read once at the
 * end — by then most of them would be gone.
 */
async function collectSaves() {
  const config = detectSavesPage(location.href);

  if (!config) {
    return { ok: false, reason: "unsupported" };
  }

  const collected = new Map();
  let idle = 0;

  for (let scroll = 0; scroll < MAX_SCROLLS; scroll += 1) {
    const before = collected.size;

    for (const link of collectSavedLinks(document, config, location.href)) {
      if (!collected.has(link.url)) {
        collected.set(link.url, link);
      }
    }

    chrome.runtime.sendMessage({ type: "COLLECT_PROGRESS", found: collected.size });

    idle = collected.size > before ? 0 : idle + 1;

    if (idle >= IDLE_SCROLLS) {
      break;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));
  }

  return {
    ok: true,
    platform: config.platform,
    section: config.section,
    links: [...collected.values()],
  };
}
