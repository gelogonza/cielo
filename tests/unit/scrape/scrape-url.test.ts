import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();

vi.mock("node:dns/promises", () => ({ default: { lookup } }));

const { scrapeUrl } = await import("@/lib/scrape/scrape-url");

const HTML = `
  <html>
    <head>
      <meta property="og:title" content="A great page" />
      <meta property="og:image" content="https://example.com/thumb.jpg" />
    </head>
    <body></body>
  </html>
`;

describe("scrapeUrl", () => {
  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => HTML,
      })),
    );
  });

  it("extracts og:title and og:image from the page", async () => {
    const result = await scrapeUrl("https://example.com/post");

    expect(result).toEqual({
      title: "A great page",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });
  });

  it("returns null when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, headers: new Headers(), text: async () => "" })),
    );

    expect(await scrapeUrl("https://example.com/missing")).toBeNull();
  });

  it("returns null when the response isn't HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        text: async () => "",
      })),
    );

    expect(await scrapeUrl("https://example.com/photo.png")).toBeNull();
  });

  it("returns null instead of throwing when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      }),
    );

    expect(await scrapeUrl("https://example.com/post")).toBeNull();
  });

  it("returns null without fetching when the URL resolves to a private IP", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5" }]);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await scrapeUrl("https://internal.example.com/")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null without fetching for a localhost URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await scrapeUrl("http://localhost:5432/")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null without fetching for a non-http(s) scheme", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await scrapeUrl("file:///etc/passwd")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("scrapeUrl thumbnail fallbacks", () => {
  function servePage(html: string, finalUrl = "https://example.com/post") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        url: finalUrl,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => html,
      })),
    );
  }

  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
  });

  it("falls back to twitter:image when there is no og:image", async () => {
    servePage(`<html><head>
      <meta name="twitter:image" content="https://example.com/tw.jpg" />
    </head></html>`);

    expect((await scrapeUrl("https://example.com/post"))?.thumbnailUrl).toBe(
      "https://example.com/tw.jpg",
    );
  });

  it("falls back to the apple-touch-icon when the page publishes no social image", async () => {
    // The real case that surfaced this: a portfolio site with no og tags at all.
    servePage(`<html><head>
      <title>Portfolio</title>
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
    </head></html>`);

    expect((await scrapeUrl("https://example.com/post"))?.thumbnailUrl).toBe(
      "https://example.com/apple-touch-icon.png",
    );
  });

  it("picks the icon declaring the largest size when there is no touch icon", async () => {
    servePage(`<html><head>
      <link rel="icon" href="/small.png" sizes="16x16" />
      <link rel="icon" href="/big.png" sizes="192x192" />
    </head></html>`);

    expect((await scrapeUrl("https://example.com/post"))?.thumbnailUrl).toBe(
      "https://example.com/big.png",
    );
  });

  it("resolves a root-relative og:image against the page URL", async () => {
    // Stored relative, these render as broken images in the feed.
    servePage(
      `<html><head><meta property="og:image" content="/og.png" /></head></html>`,
      "https://example.com/deep/post",
    );

    expect((await scrapeUrl("https://example.com/deep/post"))?.thumbnailUrl).toBe(
      "https://example.com/og.png",
    );
  });

  it("returns a null thumbnail when the page has no image of any kind", async () => {
    servePage(`<html><head><title>Bare</title></head><body></body></html>`);

    const result = await scrapeUrl("https://example.com/post");

    expect(result?.title).toBe("Bare");
    expect(result?.thumbnailUrl).toBeNull();
  });

  it("still prefers og:image over every fallback", async () => {
    servePage(`<html><head>
      <meta property="og:image" content="https://example.com/og.jpg" />
      <meta name="twitter:image" content="https://example.com/tw.jpg" />
      <link rel="apple-touch-icon" href="/icon.png" />
    </head></html>`);

    expect((await scrapeUrl("https://example.com/post"))?.thumbnailUrl).toBe(
      "https://example.com/og.jpg",
    );
  });
});
