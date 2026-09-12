import { describe, expect, it } from "vitest";
import { buildHighlightUrl, buildSavePayload } from "@/extension/src/lib/save-payload.js";

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

describe("buildSavePayload — selection context", () => {
  const info = { pageUrl: "https://example.com/post" };

  it("saves the highlighted text as a TEXT item", () => {
    const payload = buildSavePayload({
      context: "selection",
      info,
      metadata,
      selectionText: "Remember everything. Organize nothing.",
    });

    expect(payload).toMatchObject({
      body: "Remember everything. Organize nothing.",
      contentType: "TEXT",
      thumbnailUrl: null,
      // The page title, so the quote card can say where it came from.
      title: "Poster archive",
    });
  });

  it("prefers the page's live selection over Chrome's truncated one", () => {
    const payload = buildSavePayload({
      context: "selection",
      info: { ...info, selectionText: "Remember every…" },
      selectionText: "Remember everything. Organize nothing.",
    });

    expect(payload?.body).toBe("Remember everything. Organize nothing.");
  });

  it("falls back to Chrome's selectionText when the content script is absent", () => {
    const payload = buildSavePayload({
      context: "selection",
      info: { ...info, selectionText: "A quote" },
      selectionText: null,
    });

    expect(payload?.body).toBe("A quote");
  });

  it("collapses the page's line wrapping out of the quote", () => {
    const payload = buildSavePayload({
      context: "selection",
      info,
      selectionText: "  Remember\n  everything.\tOrganize   nothing.  ",
    });

    expect(payload?.body).toBe("Remember everything. Organize nothing.");
  });

  it("gives each highlight a distinct url so they do not dedupe into one item", () => {
    const first = buildSavePayload({ context: "selection", info, selectionText: "First quote" });
    const second = buildSavePayload({ context: "selection", info, selectionText: "Second quote" });

    expect(first?.url).not.toBe(second?.url);
    expect(first?.url).toContain("#:~:text=");
  });

  it("still dedupes the same quote saved twice from the same page", () => {
    const once = buildSavePayload({ context: "selection", info, selectionText: "Same quote" });
    const twice = buildSavePayload({ context: "selection", info, selectionText: "Same quote" });

    expect(once?.url).toBe(twice?.url);
  });

  it("returns null when nothing was actually selected", () => {
    expect(buildSavePayload({ context: "selection", info, selectionText: "   " })).toBeNull();
    expect(buildSavePayload({ context: "selection", info })).toBeNull();
  });

  it("returns null when there is no page to attribute the quote to", () => {
    expect(
      buildSavePayload({ context: "selection", info: {}, selectionText: "orphan" }),
    ).toBeNull();
  });

  it("honours the default section", () => {
    expect(
      buildSavePayload({
        context: "selection",
        info,
        selectionText: "A quote",
        defaultSectionId: "section-1",
      }),
    ).toMatchObject({ sectionIds: ["section-1"] });
  });
});

describe("buildHighlightUrl", () => {
  it("replaces any existing fragment rather than appending to it", () => {
    expect(buildHighlightUrl("https://example.com/p#section-2", "hello")).toBe(
      "https://example.com/p#:~:text=hello",
    );
  });

  it("percent-encodes the hyphen, which is fragment syntax", () => {
    // encodeURIComponent leaves "-" alone, but it delimits a fragment's parts.
    expect(buildHighlightUrl("https://example.com/p", "well-known")).toContain("well%2Dknown");
  });

  it("uses a start,end range for a quote too long to embed whole", () => {
    const long = `${"alpha ".repeat(40)}omega`;
    const url = buildHighlightUrl("https://example.com/p", long);

    expect(url.split("#:~:text=")[1]).toContain(",");
    expect(url).toContain("omega");
  });

  it("does not cut a range term mid-word, which would never match", () => {
    const long = `${"alpha ".repeat(40)}omega`;
    const [start] = buildHighlightUrl("https://example.com/p", long).split("#:~:text=")[1].split(",");

    expect(decodeURIComponent(start).endsWith("alpha")).toBe(true);
  });
});
