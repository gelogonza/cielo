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
