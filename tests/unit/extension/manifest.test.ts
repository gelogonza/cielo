import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const extensionDir = path.resolve(__dirname, "../../../extension");
const manifest = JSON.parse(readFileSync(path.join(extensionDir, "manifest.json"), "utf-8"));

// Regression guard for the locked permission list in bookmark-app-plan.md:
// <all_urls>, contextMenus, storage, cookies — right-click save only, no
// on-page UI overlay (no scripting permission, no default_popup content UI
// beyond the small login-status popup).
describe("extension/manifest.json", () => {
  it("is a Manifest V3 extension", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("declares exactly the locked permissions", () => {
    expect(new Set(manifest.permissions)).toEqual(new Set(["contextMenus", "storage", "cookies"]));
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
  });

  it("registers the background service worker as an ES module", () => {
    expect(manifest.background.type).toBe("module");
  });

  it("matches all URLs for the passive content script", () => {
    expect(manifest.content_scripts[0].matches).toEqual(["<all_urls>"]);
  });

  it("ships toolbar and store icons at every size Chrome asks for", () => {
    for (const size of ["16", "32", "48", "128"]) {
      expect(manifest.icons[size]).toBeDefined();
      expect(existsSync(path.join(extensionDir, manifest.icons[size]))).toBe(true);
    }
  });

  it("points the action at the popup and an existing icon", () => {
    expect(manifest.action.default_popup).toBe("src/popup.html");
    expect(existsSync(path.join(extensionDir, manifest.action.default_icon["16"]))).toBe(true);
  });

  it("references files that actually exist", () => {
    // The content script is a build artifact (npm run build:extension); if it
    // is missing the extension loads but silently never scrapes.
    for (const file of [manifest.background.service_worker, ...manifest.content_scripts[0].js]) {
      expect(existsSync(path.join(extensionDir, file)), `missing ${file}`).toBe(true);
    }
  });
});
