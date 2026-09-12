import { extractMetadata } from "./lib/extract-metadata.js";

// Passive until asked: this script is injected on every page (per the
// manifest's static content_scripts declaration, matching the plan's
// locked `<all_urls>` permission), but does nothing until the background
// script's context-menu handler asks it to scrape — there's no on-page UI.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
