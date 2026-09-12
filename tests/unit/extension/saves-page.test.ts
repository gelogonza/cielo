// @vitest-environment jsdom
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { collectSavedLinks, detectSavesPage } from "@/extension/src/lib/saves-page";

function docFrom(html: string): Document {
  return new JSDOM(html).window.document;
}

describe("detectSavesPage", () => {
  it.each([
    ["https://www.instagram.com/someone/saved/", "instagram"],
    ["https://instagram.com/someone/saved/all-posts/", "instagram"],
    ["https://www.tiktok.com/@someone", "tiktok"],
    ["https://x.com/i/bookmarks", "x"],
    ["https://twitter.com/i/bookmarks", "x"],
  ])("recognises %s", (url, platform) => {
    expect(detectSavesPage(url)?.platform).toBe(platform);
  });

  it.each([
    "https://www.instagram.com/someone/",
    "https://x.com/someone/status/1",
    "https://example.com/saved/",
    "",
  ])("does not claim %s", (url) => {
    expect(detectSavesPage(url)).toBeNull();
  });
});

describe("collectSavedLinks", () => {
  const instagram = detectSavesPage("https://www.instagram.com/me/saved/")!;
  const base = "https://www.instagram.com/me/saved/";

  it("collects post links with their rendered thumbnail and alt text", () => {
    const doc = docFrom(`<html><body>
      <a href="/p/abc123/"><img src="https://scontent.test/a.jpg" alt="A brutalist stair"></a>
      <a href="/reel/def456/"><img src="https://scontent.test/b.jpg" alt="A short film"></a>
    </body></html>`);

    expect(collectSavedLinks(doc, instagram, base)).toEqual([
      {
        url: "https://www.instagram.com/p/abc123/",
        title: "A brutalist stair",
        thumbnailUrl: "https://scontent.test/a.jpg",
      },
      {
        url: "https://www.instagram.com/reel/def456/",
        title: "A short film",
        thumbnailUrl: "https://scontent.test/b.jpg",
      },
    ]);
  });

  it("ignores the page's own navigation links", () => {
    const doc = docFrom(`<html><body>
      <a href="/me/">Profile</a>
      <a href="/explore/">Explore</a>
      <a href="/p/abc123/"><img src="https://scontent.test/a.jpg"></a>
    </body></html>`);

    expect(collectSavedLinks(doc, instagram, base)).toHaveLength(1);
  });

  it("collapses the same post linked more than once", () => {
    // These grids link the image and the caption separately.
    const doc = docFrom(`<html><body>
      <a href="/p/abc123/"><img src="https://scontent.test/a.jpg" alt="Real"></a>
      <a href="/p/abc123/?img_index=2">caption</a>
    </body></html>`);

    const links = collectSavedLinks(doc, instagram, base);

    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Real");
  });

  it("drops tracking params so the same post dedupes on import", () => {
    const doc = docFrom(`<html><body><a href="/p/abc123/?utm_source=ig_web"><img src="x.jpg"></a></body></html>`);

    expect(collectSavedLinks(doc, instagram, base)[0].url).toBe(
      "https://www.instagram.com/p/abc123/",
    );
  });

  it("still collects a post that has no thumbnail yet", () => {
    // Lazy grids render the anchor before the image loads.
    const doc = docFrom(`<html><body><a href="/p/abc123/"></a></body></html>`);

    expect(collectSavedLinks(doc, instagram, base)[0]).toMatchObject({
      thumbnailUrl: null,
      title: null,
    });
  });

  it("collects TikTok videos from a profile grid", () => {
    const tiktok = detectSavesPage("https://www.tiktok.com/@me")!;
    const doc = docFrom(`<html><body>
      <a href="https://www.tiktok.com/@someone/video/123"><img src="t.jpg" alt="A clip"></a>
      <a href="https://www.tiktok.com/@someone">Profile</a>
    </body></html>`);

    const links = collectSavedLinks(doc, tiktok, "https://www.tiktok.com/@me");

    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://www.tiktok.com/@someone/video/123");
  });

  it("collects X bookmarks as status links", () => {
    const x = detectSavesPage("https://x.com/i/bookmarks")!;
    const doc = docFrom(`<html><body>
      <a href="/someone/status/1234567890"><img src="p.jpg" alt="A post"></a>
      <a href="/someone">Someone</a>
    </body></html>`);

    expect(collectSavedLinks(doc, x, "https://x.com/i/bookmarks")).toHaveLength(1);
  });
});
