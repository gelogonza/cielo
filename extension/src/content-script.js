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
    sendResponse({ ok: true, metadata });
  } catch (error) {
    sendResponse({ ok: false, error: String(error) });
  }

  return false;
});
