import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("registers Cielo as a share target pointed at /save", () => {
    // If this drifts, Cielo silently vanishes from the OS share sheet.
    expect(manifest().share_target).toEqual({
      action: "/save",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    });
  });

  it("reads the link from both url and text params", () => {
    // Apps disagree about which field carries the link; /save handles both, so
    // the manifest has to request both.
    const params = manifest().share_target?.params ?? {};

    expect(params).toHaveProperty("url");
    expect(params).toHaveProperty("text");
  });

  it("ships installable icons at the sizes Android requires", () => {
    const sizes = (manifest().icons ?? []).map((icon) => icon.sizes);

    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((manifest().icons ?? []).some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("opens straight into the library when launched from the home screen", () => {
    expect(manifest().start_url).toBe("/library");
    expect(manifest().display).toBe("standalone");
  });
});
