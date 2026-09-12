import { describe, expect, it } from "vitest";
import { buildSavePayload } from "@/extension/src/lib/save-payload.js";

const metadata = {
  url: "https://are.na/block/1",
  title: "Poster archive",
  thumbnailUrl: "https://cdn.test/thumb.jpg",
  contentType: "LINK",
  sourcePlatform: "web",
};

describe("buildSavePayload — page context", () => {
  it("saves the scraped page", () => {
    expect(buildSavePayload({ context: "page", metadata })).toMatchObject({
      url: "https://are.na/block/1",
      title: "Poster archive",
      thumbnailUrl: "https://cdn.test/thumb.jpg",
      contentType: "LINK",
    });
  });

  it("returns null when the scrape found no url", () => {
    expect(buildSavePayload({ context: "page", metadata: { ...metadata, url: null } })).toBeNull();
    expect(buildSavePayload({ context: "page", metadata: null })).toBeNull();
  });
});

describe("buildSavePayload — link context", () => {
  it("saves the link target, leaving the title for the server to scrape", () => {
    expect(
      buildSavePayload({ context: "link", info: { linkUrl: "https://tiktok.com/@u/video/1" } }),
    ).toMatchObject({
      url: "https://tiktok.com/@u/video/1",
      title: null,
      thumbnailUrl: null,
      contentType: "LINK",
      sourcePlatform: "tiktok",
    });
  });

  it("returns null when the click carried no link", () => {
    expect(buildSavePayload({ context: "link", info: {} })).toBeNull();
  });
});

describe("buildSavePayload — image context", () => {
  it("saves the image as its own thumbnail", () => {
    expect(
      buildSavePayload({
        context: "image",
        info: { srcUrl: "https://cdn.test/pic.jpg", pageUrl: "https://instagram.com/p/abc" },
        metadata,
      }),
    ).toMatchObject({
      url: "https://cdn.test/pic.jpg",
      thumbnailUrl: "https://cdn.test/pic.jpg",
      contentType: "IMAGE",
      sourcePlatform: "instagram",
    });
  });

  it("returns null when the click carried no image", () => {
    expect(buildSavePayload({ context: "image", info: {} })).toBeNull();
  });
});

describe("buildSavePayload — default section", () => {
  it("sends the chosen section", () => {
    expect(
      buildSavePayload({ context: "page", metadata, defaultSectionId: "section-1" }),
    ).toMatchObject({ sectionIds: ["section-1"] });
  });

  it("sends no section for General, which is a computed view", () => {
    expect(buildSavePayload({ context: "page", metadata, defaultSectionId: null })).toMatchObject({
      sectionIds: [],
    });
  });
});

describe("buildSavePayload — platform detection", () => {
  it.each([
    ["https://www.tiktok.com/@u/video/1", "tiktok"],
    ["https://instagram.com/p/abc", "instagram"],
    ["https://x.com/u/status/1", "x"],
    ["https://twitter.com/u/status/1", "x"],
    ["https://are.na/block/1", "web"],
    ["https://tiktok.com.evil.test/x", "web"],
  ])("classifies %s as %s", (url, expected) => {
    expect(buildSavePayload({ context: "link", info: { linkUrl: url } })).toMatchObject({
      sourcePlatform: expected,
    });
  });

  it("falls back to web for an unparseable link", () => {
    expect(buildSavePayload({ context: "link", info: { linkUrl: "not a url" } })).toMatchObject({
      sourcePlatform: "web",
    });
  });
});
