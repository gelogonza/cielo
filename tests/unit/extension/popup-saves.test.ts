// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Renders the real popup against a stubbed `chrome`.
 *
 * popup.js does its work on import — there is no exported entry point — so
 * each case resets the module registry and imports it again.
 */
const sent: unknown[] = [];
let stored: Record<string, unknown> = {};
let tab: { id: number; url: string } | undefined;
let changeListener: ((changes: Record<string, { newValue: unknown }>) => void) | undefined;

function stubChrome({ signedIn = true } = {}) {
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: (message: unknown) => sent.push(message) },
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const wanted = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            wanted.filter((key) => key in stored).map((key) => [key, stored[key]]),
          );
        },
        set: async (values: Record<string, unknown>) => Object.assign(stored, values),
        remove: async (key: string) => {
          delete stored[key];
        },
      },
      onChanged: {
        addListener: (fn: typeof changeListener) => {
          changeListener = fn;
        },
      },
    },
    cookies: {
      getAll: async () => (signedIn ? [{ name: "sb-abcdefgh-auth-token" }] : []),
    },
    tabs: { query: async () => (tab ? [tab] : []) },
  });
}

/** Lets the popup's own awaits settle before the DOM is read. */
async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
  }
}

async function openPopup() {
  document.body.innerHTML = '<div id="root"></div>';
  vi.resetModules();
  await import("@/extension/src/popup.js");
  await settle();
}

function panelText() {
  return document.body.innerText || document.body.textContent || "";
}

function button(label: string) {
  return [...document.querySelectorAll("button")].find((element) =>
    element.textContent?.includes(label),
  );
}

beforeEach(() => {
  sent.length = 0;
  stored = {};
  tab = { id: 7, url: "https://www.instagram.com/someone/saved/" };
  changeListener = undefined;
  stubChrome();
});

describe("popup — reading a saves page", () => {
  it("offers to read the page, and says nothing is saved yet", async () => {
    await openPopup();

    expect(panelText()).toContain("You're on your Instagram saves page");
    expect(panelText()).toContain("before anything is saved");
    expect(button("Read your")).toBeDefined();
  });

  it("asks the worker to collect, not to import", async () => {
    await openPopup();

    button("Read your")!.click();

    // The distinction that matters: nothing reaches Cielo on this click.
    expect(sent).toContainEqual({ type: "COLLECT_SAVES_ONLY", tabId: 7 });
    expect(sent).not.toContainEqual(expect.objectContaining({ type: "CONFIRM_IMPORT" }));
  });

  it("shows what was found, and where it would go, before importing", async () => {
    stored.savesImport = {
      state: "collected",
      links: [{ url: "https://instagram.com/p/1" }, { url: "https://instagram.com/p/2" }],
      section: "Instagram",
      platform: "instagram",
    };

    await openPopup();

    expect(panelText()).toContain("Found 2 saved posts");
    expect(panelText()).toContain("section called Instagram");
    expect(button("Import 2")).toBeDefined();
  });

  it("only imports once confirmed", async () => {
    stored.savesImport = {
      state: "collected",
      links: [{ url: "https://instagram.com/p/1" }],
      section: "Instagram",
      platform: "instagram",
    };

    await openPopup();
    expect(sent).not.toContainEqual({ type: "CONFIRM_IMPORT" });

    button("Import 1")!.click();
    expect(sent).toContainEqual({ type: "CONFIRM_IMPORT" });
  });

  it("lets the user throw away a bad read without importing it", async () => {
    stored.savesImport = {
      state: "collected",
      links: [{ url: "https://instagram.com/p/1" }],
      section: "Instagram",
      platform: "instagram",
    };

    await openPopup();
    button("discard")!.click();

    expect(sent).toContainEqual({ type: "DISCARD_COLLECTED" });
    expect(sent).not.toContainEqual({ type: "CONFIRM_IMPORT" });
  });

  it("follows the worker's progress through storage", async () => {
    await openPopup();

    changeListener!({
      savesImport: { newValue: { state: "saving", done: 40, total: 120 } },
    });

    expect(panelText()).toContain("Saving 40 of 120");
  });

  it("suggests scrolling when a read finds nothing", async () => {
    stored.savesImport = {
      state: "error",
      message: "No saved posts found. Scroll the page yourself and try again.",
    };

    await openPopup();

    expect(panelText()).toContain("Scroll the page yourself");
  });

  it("offers nothing on a page that is not a saves page", async () => {
    tab = { id: 7, url: "https://example.com/" };

    await openPopup();

    expect(button("Read your")).toBeUndefined();
  });
});
