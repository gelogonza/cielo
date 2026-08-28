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
