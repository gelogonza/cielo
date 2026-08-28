import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the locked permission list in bookmark-app-plan.md:
// <all_urls>, contextMenus, storage, cookies — right-click save only, no
// on-page UI overlay (no scripting permission, no default_popup content UI
// beyond the small login-status popup).
describe("extension/manifest.json", () => {
  const manifest = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../extension/manifest.json"), "utf-8"),
  );

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
});
