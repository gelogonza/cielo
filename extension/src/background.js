import { API_BASE_URL } from "./lib/config.js";

const CONTEXT_MENU_ID = "save-to-cielo";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Save to Cielo",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
    handleSave(tab.id);
  }
});

async function handleSave(tabId) {
  try {
    const scrapeResult = await requestScrape(tabId);

    if (!scrapeResult?.ok) {
      await recordSaveOutcome({ status: "error", message: "Couldn't read this page." });
      return;
    }

    const { metadata } = scrapeResult;

    if (!metadata.url) {
      await recordSaveOutcome({ status: "error", message: "No URL found to save." });
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/save`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: metadata.url,
        title: metadata.title,
        thumbnailUrl: metadata.thumbnailUrl,
        contentType: metadata.contentType,
        sourcePlatform: metadata.sourcePlatform,
        sectionIds: [],
        tagNames: [],
      }),
    });

    if (response.status === 401) {
      await recordSaveOutcome({ status: "signed_out" });
      return;
    }

    if (!response.ok) {
      await recordSaveOutcome({ status: "error", message: `Save failed (${response.status}).` });
      return;
    }

    const saved = await response.json();
    await recordSaveOutcome({
      status: "success",
      title: saved.title ?? saved.url,
      reused: saved.reused,
    });
  } catch (error) {
    await recordSaveOutcome({ status: "error", message: String(error) });
  }
}

// Resolves null (rather than rejecting) when there's no content script to
// answer — e.g. chrome:// pages, or a tab that hasn't finished loading.
function requestScrape(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

async function recordSaveOutcome(outcome) {
  await chrome.storage.local.set({ lastSaveOutcome: { ...outcome, at: Date.now() } });
}
