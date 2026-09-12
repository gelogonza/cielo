import { API_BASE_URL } from "./lib/config.js";
import { GENERAL, resolveDefaultSection } from "./lib/default-section.js";
import { hasSessionCookie } from "./lib/has-session-cookie.js";
import { resolvePopupState } from "./lib/popup-state.js";
import { detectSavesPage } from "./lib/saves-page.js";

const root = document.getElementById("root");

async function render() {
  // Opening the popup acknowledges whatever the badge was reporting.
  chrome.runtime.sendMessage({ type: "POPUP_OPENED" });

  const [stored, cookies] = await Promise.all([
    chrome.storage.local.get(["lastSaveOutcome", "defaultSectionId"]),
    chrome.cookies.getAll({ url: API_BASE_URL }),
  ]);

  const state = resolvePopupState({
    signedIn: hasSessionCookie(cookies),
    outcome: stored.lastSaveOutcome ?? null,
  });

  // The outcome has now been shown, so the next open falls back to ready.
  if (stored.lastSaveOutcome) {
    await chrome.storage.local.remove("lastSaveOutcome");
  }

  paint(state, stored.defaultSectionId ?? null);

  if (state.kind !== "signed-out") {
    void paintSavesImport(stored.savesImport ?? null);
  }
}

/**
 * The one thing only the extension can do: read the platform's own saves page
 * from inside the user's logged-in session. Instagram and TikTok expose this
 * data through no API at all.
 */
async function paintSavesImport(initial) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const config = tab?.url ? detectSavesPage(tab.url) : null;
  const progress = initial;

  // Show a finished or failed run even when the user has navigated away.
  if (!config && !(progress && progress.state !== "idle")) {
    return;
  }

  const panel = document.createElement("div");
  panel.className = "saves";
  root.appendChild(panel);

  const render = (state) => {
    panel.replaceChildren();

    if (state?.state === "collecting") {
      panel.append(text(`Reading your saves… ${state.found ?? 0} found`));
      return;
    }

    if (state?.state === "saving") {
      panel.append(text(`Saving ${state.done} of ${state.total}…`));
      return;
    }

    if (state?.state === "error") {
      panel.append(footnote(state.message, true));
      return;
    }

    if (state?.state === "done") {
      panel.append(
        text(
          `${state.imported} brought over${state.reused ? `, ${state.reused} already saved` : ""}.`,
        ),
      );

      if (state.batchIds?.length) {
        const undo = document.createElement("button");
        undo.className = "link-button";
        undo.textContent = "Undo this import";
        undo.addEventListener("click", async () => {
          undo.disabled = true;
          undo.textContent = "Undoing…";

          let removed = 0;
          for (const batchId of state.batchIds) {
            const response = await fetch(`${API_BASE_URL}/api/import/${batchId}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (response.ok) removed += (await response.json()).itemsRemoved;
          }

          await chrome.storage.local.remove("savesImport");
          panel.replaceChildren(text(`Undone — ${removed} removed.`));
        });
        panel.append(undo);
      }

      return;
    }

    const button = document.createElement("button");
    button.className = "button";
    button.textContent = `Import your ${config.label}`;
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "IMPORT_SAVES", tabId: tab.id });
      render({ state: "collecting", found: 0 });
    });

    panel.append(divider(), text(`You're on your ${config.label} page.`), button);
  };

  render(progress);

  // The work runs in the service worker, so the popup follows along by
  // watching storage rather than holding the process open.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.savesImport) {
      render(changes.savesImport.newValue);
    }
  });
}

function paint(state, defaultSectionId) {
  root.replaceChildren(header());

  if (state.kind === "signed-out") {
    root.append(text("Log in to start saving."), linkButton("Log in", `${API_BASE_URL}/login`));
    return;
  }

  if (state.kind === "saved") {
    root.append(
      savedItem(state),
      footnote("Saving it again adds it to another section instead of duplicating it."),
    );
    return;
  }

  if (state.kind === "error") {
    root.append(footnote(state.message, true), linkButton("Open Cielo", `${API_BASE_URL}/library`));
    return;
  }

  root.append(text("Right-click any page and choose Save to Cielo."), divider());

  const row = sectionRow(defaultSectionId);
  root.append(row.element);
  void loadSections(row, defaultSectionId);
}

function header() {
  const element = document.createElement("div");
  element.className = "header";
  element.textContent = "Cielo";
  return element;
}

function text(content) {
  const element = document.createElement("p");
  element.className = "body-text";
  element.textContent = content;
  return element;
}

function footnote(content, isError = false) {
  const element = document.createElement("p");
  element.className = isError ? "footnote error" : "footnote";
  element.textContent = content;
  return element;
}

function divider() {
  const element = document.createElement("div");
  element.className = "divider";
  return element;
}

function linkButton(label, href) {
  const element = document.createElement("a");
  element.className = "button";
  element.href = href;
  element.target = "_blank";
  element.rel = "noreferrer";
  element.textContent = label;
  return element;
}

function savedItem({ title, thumbnailUrl, sectionName, reused }) {
  const container = document.createElement("div");
  container.className = "saved-item";

  const thumb = document.createElement(thumbnailUrl ? "img" : "div");
  thumb.className = "thumb";

  if (thumbnailUrl) {
    thumb.src = thumbnailUrl;
    thumb.alt = "";
    thumb.referrerPolicy = "no-referrer";
  }

  const meta = document.createElement("div");
  meta.className = "meta";

  const titleElement = document.createElement("div");
  titleElement.className = "meta-title";
  titleElement.textContent = title;
  titleElement.title = title;

  const sub = document.createElement("div");
  sub.className = "meta-sub";
  sub.textContent = reused ? `Already saved — added to ${sectionName}` : `Saved to ${sectionName}`;

  meta.append(titleElement, sub);
  container.append(thumb, meta);
  return container;
}

/**
 * "Save to" picker. Renders immediately showing the stored choice, then
 * swaps in the real section list once the API answers — so the popup never
 * blocks on a network round-trip.
 */
function sectionRow(defaultSectionId) {
  const element = document.createElement("div");
  element.className = "section-row";

  const label = document.createElement("label");
  label.textContent = "Save to";
  label.htmlFor = "default-section";

  const select = document.createElement("select");
  select.id = "default-section";
  select.append(option(GENERAL.name, ""));
  select.value = "";
  select.disabled = true;

  select.addEventListener("change", async () => {
    if (select.value) {
      await chrome.storage.local.set({ defaultSectionId: select.value });
    } else {
      await chrome.storage.local.remove("defaultSectionId");
    }
  });

  element.append(label, select);
  return { element, select, defaultSectionId };
}

async function loadSections(row) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sections`, { credentials: "include" });

    if (!response.ok) {
      return;
    }

    const { sections = [] } = await response.json();
    const resolved = resolveDefaultSection(row.defaultSectionId, sections);

    row.select.replaceChildren(
      option(GENERAL.name, ""),
      ...sections.map((section) => option(section.name, section.id)),
    );
    row.select.value = resolved.id ?? "";
    row.select.disabled = false;

    // The stored section is gone from the server — drop it so the next save
    // does not keep aiming at a section that no longer exists.
    if (row.defaultSectionId && !resolved.id) {
      await chrome.storage.local.remove("defaultSectionId");
    }
  } catch {
    // Offline or the app is down; the picker stays on General and disabled.
  }
}

function option(label, value) {
  const element = document.createElement("option");
  element.textContent = label;
  element.value = value;
  return element;
}

render();
