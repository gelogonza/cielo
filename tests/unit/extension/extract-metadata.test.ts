// @vitest-environment jsdom
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { detectPlatform, extractMetadata } from "@/extension/src/lib/extract-metadata";

function docFrom(html: string): Document {
  return new JSDOM(html).window.document;
}

describe("detectPlatform", () => {
  it.each([
    ["tiktok.com", "tiktok"],
    ["www.tiktok.com", "tiktok"],
    ["instagram.com", "instagram"],
    ["www.instagram.com", "instagram"],
    ["x.com", "x"],
    ["twitter.com", "x"],
    ["www.example-blog.com", "web"],
  ])("maps %s to %s", (hostname, expected) => {
    expect(detectPlatform(hostname)).toBe(expected);
  });
});

describe("extractMetadata", () => {
  it("extracts title and image from a generic webpage via og tags", () => {
    const doc = docFrom(`
      <html><head>
        <meta property="og:title" content="A great article" />
        <meta property="og:image" content="https://example.com/cover.jpg" />
        <title>Fallback title</title>
      </head></html>
    `);

    const result = extractMetadata(doc, "example.com", "https://example.com/post?x=1");

    expect(result).toEqual({
      title: "A great article",
      thumbnailUrl: "https://example.com/cover.jpg",
      contentType: "LINK",
      sourcePlatform: "web",
      url: "https://example.com/post?x=1",
    });
  });

  it("prefers <link rel=canonical> over the address-bar URL, to avoid tracking-param dupes", () => {
    const doc = docFrom(`
      <html><head>
        <link rel="canonical" href="https://example.com/post" />
      </head></html>
    `);

    expect(extractMetadata(doc, "example.com", "https://example.com/post?utm_source=x").url).toBe(
      "https://example.com/post",
    );
  });

  it("falls back to og:url when there is no canonical link", () => {
    const doc = docFrom(`
      <html><head>
        <meta property="og:url" content="https://example.com/post" />
      </head></html>
    `);

    expect(extractMetadata(doc, "example.com", "https://example.com/post?utm_source=x").url).toBe(
      "https://example.com/post",
    );
  });

  it("falls back to the <title> tag when og:title is missing", () => {
    const doc = docFrom(`<html><head><title>Plain page</title></head></html>`);

    expect(extractMetadata(doc, "example.com").title).toBe("Plain page");
  });

  it("falls back to twitter:image when og:image is absent", () => {
    const doc = docFrom(`
      <html><head>
        <meta name="twitter:title" content="Tweet-shaped page" />
        <meta name="twitter:image" content="https://example.com/tw.jpg" />
      </head></html>
    `);

    const result = extractMetadata(doc, "x.com");

    expect(result.title).toBe("Tweet-shaped page");
    expect(result.thumbnailUrl).toBe("https://example.com/tw.jpg");
  });

  it("classifies a page with an og:video tag as VIDEO", () => {
    const doc = docFrom(`
      <html><head>
        <meta property="og:title" content="A TikTok" />
        <meta property="og:image" content="https://tiktok.com/poster.jpg" />
        <meta property="og:video" content="https://tiktok.com/video.mp4" />
      </head></html>
    `);

    expect(extractMetadata(doc, "www.tiktok.com").contentType).toBe("VIDEO");
  });

  it("classifies multiple og:image tags as a CAROUSEL (Instagram/X multi-image posts)", () => {
    const doc = docFrom(`
      <html><head>
        <meta property="og:title" content="A carousel post" />
        <meta property="og:image" content="https://instagram.com/1.jpg" />
        <meta property="og:image" content="https://instagram.com/2.jpg" />
        <meta property="og:image" content="https://instagram.com/3.jpg" />
      </head></html>
    `);

    const result = extractMetadata(doc, "www.instagram.com");

    expect(result.contentType).toBe("CAROUSEL");
    expect(result.thumbnailUrl).toBe("https://instagram.com/1.jpg");
  });

  it("classifies a single image on a known platform as IMAGE", () => {
    const doc = docFrom(`
      <html><head>
        <meta property="og:title" content="A single photo post" />
        <meta property="og:image" content="https://instagram.com/only.jpg" />
      </head></html>
    `);

    expect(extractMetadata(doc, "www.instagram.com").contentType).toBe("IMAGE");
  });

  it("returns null title/thumbnailUrl/url when nothing is found", () => {
    const doc = docFrom(`<html><head></head></html>`);

    expect(extractMetadata(doc, "example.com")).toEqual({
      title: null,
      thumbnailUrl: null,
      contentType: "LINK",
      sourcePlatform: "web",
      url: null,
    });
  });
});

describe("extractMetadata thumbnail fallbacks", () => {
  const page = "https://www.priyamwada.me/";

  it("borrows a large in-page image when the page publishes no og:image", () => {
    // The real case that surfaced this: a portfolio with no og tags at all.
    const doc = docFrom(`<html><head><title>Portfolio</title></head><body>
      <img src="/spacer.gif" width="1" height="1" />
      <img src="/hero.jpg" width="1200" height="800" />
    </body></html>`);

    expect(extractMetadata(doc, "www.priyamwada.me", page).thumbnailUrl).toBe(
      "https://www.priyamwada.me/hero.jpg",
    );
  });

  it("picks the largest in-page image by area", () => {
    const doc = docFrom(`<html><body>
      <img src="/small.jpg" width="220" height="220" />
      <img src="/big.jpg" width="900" height="600" />
      <img src="/medium.jpg" width="400" height="300" />
    </body></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/").thumbnailUrl).toBe(
      "https://example.com/big.jpg",
    );
  });

  it("ignores tracking pixels, icons and inline data URIs", () => {
    const doc = docFrom(`<html><body>
      <img src="https://track.test/p.gif" width="1" height="1" />
      <img src="/icon.png" width="32" height="32" />
      <img src="data:image/png;base64,AAAA" width="800" height="800" />
    </body></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/").thumbnailUrl).toBeNull();
  });

  it("falls back to the apple-touch-icon when there is no usable page image", () => {
    const doc = docFrom(`<html><head>
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
    </head><body></body></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/").thumbnailUrl).toBe(
      "https://example.com/apple-touch-icon.png",
    );
  });

  it("picks the largest declared icon when there is no touch icon", () => {
    const doc = docFrom(`<html><head>
      <link rel="icon" href="/small.png" sizes="16x16" />
      <link rel="icon" href="/big.png" sizes="192x192" />
    </head><body></body></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/").thumbnailUrl).toBe(
      "https://example.com/big.png",
    );
  });

  it("resolves a root-relative og:image against the page URL", () => {
    const doc = docFrom(`<html><head>
      <meta property="og:image" content="/og.png" />
    </head></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/deep/post").thumbnailUrl).toBe(
      "https://example.com/og.png",
    );
  });

  it("still prefers og:image over every fallback", () => {
    const doc = docFrom(`<html><head>
      <meta property="og:image" content="https://cdn.test/og.jpg" />
      <link rel="apple-touch-icon" href="/icon.png" />
    </head><body><img src="/hero.jpg" width="1200" height="800" /></body></html>`);

    expect(extractMetadata(doc, "example.com", "https://example.com/").thumbnailUrl).toBe(
      "https://cdn.test/og.jpg",
    );
  });

  it("does not let a borrowed page image change contentType", () => {
    // A single og:image on a platform means IMAGE; a borrowed one must not.
    const doc = docFrom(`<html><body>
      <img src="/hero.jpg" width="1200" height="800" />
    </body></html>`);

    expect(extractMetadata(doc, "instagram.com", "https://instagram.com/p/a").contentType).toBe(
      "LINK",
    );
  });
});
