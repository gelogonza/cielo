import { getApiBaseUrl } from "./lib/config.js";
import { SAVE_CONTEXTS, buildSavePayload } from "./lib/save-payload.js";

const MENU_PREFIX = "save-to-cielo";

// One menu item per context so the label can say what will actually be saved —
// "Save image to Cielo" on an image is clearer than a generic page save.
const MENU_ITEMS = [
  { context: "page", title: "Save page to Cielo", contexts: ["page"] },
  { context: "link", title: "Save link to Cielo", contexts: ["link"] },
  { context: "image", title: "Save image to Cielo", contexts: ["image"] },
  // Chrome treats a selection as its own context, so this replaces the page
  // item whenever text is highlighted rather than competing with it.
  { context: "selection", title: "Save selection to Cielo", contexts: ["selection"] },
];

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first so an upgrade that changes the menu doesn't duplicate it.
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create({
        id: `${MENU_PREFIX}:${item.context}`,
        title: item.title,
        contexts: item.contexts,
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const [prefix, context] = String(info.menuItemId).split(":");

  if (prefix === MENU_PREFIX && SAVE_CONTEXTS.includes(context)) {
    handleSave(context, info, tab);
  }
});

async function handleSave(context, info, tab) {
  await setBadge("…", "#9e9e9e");

  try {
    // Only a page or image save needs the page's own metadata; a link save is
    // resolved server-side, so don't pay for a scrape that would be discarded.
    const metadata = context === "link" ? null : ((await requestScrape(tab?.id))?.metadata ?? null);

    const [apiBaseUrl, { defaultSectionId }] = await Promise.all([
      getApiBaseUrl(),
      chrome.storage.local.get("defaultSectionId"),
    ]);

    const payload = buildSavePayload({
      context,
      info,
      metadata,
      defaultSectionId: defaultSectionId ?? null,
    });

    if (!payload) {
      await recordSaveOutcome({ status: "error", message: "Nothing to save on this page." });
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/save`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      thumbnailUrl: saved.thumbnailUrl ?? null,
      sectionName: saved.sections?.[0]?.name ?? "General",
      reused: saved.reused,
    });
  } catch (error) {
    // Most likely the web app is unreachable; the popup shows the message.
    await recordSaveOutcome({ status: "error", message: String(error) });
  }
}

// Resolves null (rather than rejecting) when there's no content script to
// answer — e.g. chrome:// pages, or a tab that hasn't finished loading.
function requestScrape(tabId, srcUrl) {
  if (!tabId) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "SCRAPE_PAGE", srcUrl }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.ok ? response : null);
    });
  });
}

async function recordSaveOutcome(outcome) {
  await chrome.storage.local.set({ lastSaveOutcome: { ...outcome, at: Date.now() } });

  // The popup is usually closed during a context-menu save, so the toolbar
  // badge is the only feedback the user actually sees.
  if (outcome.status === "success") {
    await setBadge("✓", "#95ff00");
  } else if (outcome.status === "signed_out") {
    await setBadge("!", "#9e9e9e");
  } else {
    await setBadge("!", "#ff4d4d");
  }
}

async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// Opening the popup is the user acknowledging the result, so clear the badge.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "POPUP_OPENED") {
    chrome.action.setBadgeText({ text: "" });
  }

  if (message?.type === "COLLECT_PROGRESS") {
    void chrome.storage.local.set({
      savesImport: { state: "collecting", found: message.found },
    });
  }

  if (message?.type === "IMPORT_SAVES") {
    // Runs here rather than in the popup so closing the popup mid-import does
    // not abandon it.
    void importSaves(message.tabId ?? sender.tab?.id);
  }

  return false;
});

/** Chunk size, matching the server's per-request ceiling. */
const IMPORT_CHUNK = 200;

/**
 * Reads the saved posts off the page the user is looking at and files them.
 *
 * This is the one thing the extension can do that nothing else can: these
 * pages have no API, and their contents only exist inside the user's own
 * logged-in session.
 */
async function importSaves(tabId) {
  const setState = (savesImport) => chrome.storage.local.set({ savesImport });

  if (!tabId) {
    await setState({ state: "error", message: "No page to read." });
    return;
  }

  const apiBaseUrl = await getApiBaseUrl();

  await setState({ state: "collecting", found: 0 });

  const collected = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "COLLECT_SAVES" }, (response) => {
      resolve(chrome.runtime.lastError ? null : response);
    });
  });

  if (!collected?.ok) {
    await setState({ state: "error", message: "That page is not a saves page." });
    return;
  }

  if (collected.links.length === 0) {
    await setState({ state: "error", message: "No saved posts found on that page." });
    return;
  }

  const entries = collected.links.map((link) => ({
    ...link,
    folder: collected.section,
    tags: [],
    savedAt: null,
  }));

  const totals = { imported: 0, reused: 0, batchIds: [] };

  for (let index = 0; index < entries.length; index += IMPORT_CHUNK) {
    const chunk = entries.slice(index, index + IMPORT_CHUNK);

    await setState({ state: "saving", done: index, total: entries.length });

    let response;

    try {
      response = await fetch(`${apiBaseUrl}/api/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: chunk }),
      });
    } catch {
      await setState({ state: "error", message: "Could not reach Cielo." });
      return;
    }

    if (response.status === 401) {
      await setState({ state: "error", message: "Log in to Cielo first." });
      return;
    }

    if (!response.ok) {
      await setState({ state: "error", message: `Import failed (${response.status}).` });
      return;
    }

    const batch = await response.json();
    totals.imported += batch.imported;
    totals.reused += batch.reused;
    totals.batchIds.push(batch.batchId);
  }

  await setState({ state: "done", ...totals, platform: collected.platform });
  await setBadge("\u2713", "#95ff00");
}
