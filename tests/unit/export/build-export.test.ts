import { describe, expect, it } from "vitest";
import {
  buildBookmarksHtml,
  buildJsonExport,
  exportFileName,
} from "@/lib/export/build-export";
import type { SerializedItem } from "@/lib/items/serialize";

const exportedAt = new Date("2026-09-19T12:00:00.000Z");

function item(overrides: Partial<SerializedItem> = {}): SerializedItem {
  return {
    id: "item-1",
    url: "https://mymind.com",
    title: "mymind",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK",
    sourceType: "WEB",
    sourcePlatform: "web",
    savedAt: "2026-09-12T10:00:00.000Z",
    sections: [],
    tags: [],
    note: null,
    ...overrides,
  };
}

describe("buildJsonExport", () => {
  it("is a self-describing envelope around the wire shape", () => {
    const result = buildJsonExport([item()], exportedAt);

    expect(result).toEqual({
      format: "cielo-export",
      version: 1,
      exportedAt: "2026-09-19T12:00:00.000Z",
      itemCount: 1,
      items: [item()],
    });
  });

  it("keeps items the bookmark format cannot hold", () => {
    // A highlight with no source: no URL, so no <A HREF> — JSON is the only
    // format that does not lose it.
    const highlight = item({ url: null, title: null, body: "a line worth keeping" });
    const result = buildJsonExport([highlight], exportedAt);

    expect(result.items[0].body).toBe("a line worth keeping");
  });

  it("reports an empty library honestly rather than failing", () => {
    expect(buildJsonExport([], exportedAt)).toMatchObject({ itemCount: 0, items: [] });
  });
});

describe("buildBookmarksHtml", () => {
  it("writes a file browsers recognise", () => {
    const { html } = buildBookmarksHtml([item()], exportedAt);

    expect(html.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
    expect(html).toContain('<A HREF="https://mymind.com"');
  });

  it("records the original save time in seconds, not milliseconds", () => {
    const { html } = buildBookmarksHtml([item()], exportedAt);

    // 2026-09-12T10:00:00Z
    expect(html).toContain(`ADD_DATE="${Date.parse("2026-09-12T10:00:00.000Z") / 1000}"`);
  });

  it("turns sections into folders", () => {
    const { html } = buildBookmarksHtml(
      [item({ sections: [{ id: "s1", name: "Inspo" }] })],
      exportedAt,
    );

    expect(html).toContain("<H3");
    expect(html).toContain(">Inspo</H3>");
  });

  it("writes an item in two sections under both, because re-import reunites them", () => {
    const { html } = buildBookmarksHtml(
      [
        item({
          sections: [
            { id: "s1", name: "Inspo" },
            { id: "s2", name: "Reading" },
          ],
        }),
      ],
      exportedAt,
    );

    expect(html).toContain(">Inspo</H3>");
    expect(html).toContain(">Reading</H3>");
    expect(html.match(/<A HREF="https:\/\/mymind\.com"/g)).toHaveLength(2);
  });

  it("leaves unfiled items at the top level", () => {
    const { html } = buildBookmarksHtml([item()], exportedAt);

    expect(html).not.toContain("<H3");
  });

  it("writes tags in the attribute our own importer reads back", () => {
    const { html } = buildBookmarksHtml(
      [
        item({
          tags: [
            { id: "t1", name: "design" },
            { id: "t2", name: "type" },
          ],
        }),
      ],
      exportedAt,
    );

    expect(html).toContain('TAGS="design,type"');
  });

  it("omits the tags attribute entirely when there are none", () => {
    expect(buildBookmarksHtml([item()], exportedAt).html).not.toContain("TAGS=");
  });

  it("writes a note as the format's description field, flattened to one line", () => {
    const { html } = buildBookmarksHtml([item({ note: "first line\n\nsecond line" })], exportedAt);

    expect(html).toContain("<DD>first line second line");
  });

  it("falls back to the highlight text when there is no note", () => {
    const { html } = buildBookmarksHtml([item({ note: null, body: "a quote" })], exportedAt);

    expect(html).toContain("<DD>a quote");
  });

  it("falls back to the URL when an item has no title", () => {
    const { html } = buildBookmarksHtml([item({ title: null })], exportedAt);

    expect(html).toContain(">https://mymind.com</A>");
  });

  it("escapes markup in titles, sections and urls so the file still parses", () => {
    const { html } = buildBookmarksHtml(
      [
        item({
          title: '<script>alert("x")</script> & more',
          url: 'https://example.com/?a=1&b="2"',
          sections: [{ id: "s1", name: "R&D <team>" }],
        }),
      ],
      exportedAt,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('HREF="https://example.com/?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain(">R&amp;D &lt;team&gt;</H3>");
  });

  it("counts the items it could not represent instead of dropping them silently", () => {
    const { html, omitted } = buildBookmarksHtml(
      [item(), item({ id: "item-2", url: null, body: "a source-less highlight" })],
      exportedAt,
    );

    expect(omitted).toBe(1);
    expect(html).not.toContain("source-less");
  });

  it("produces a valid empty file for an empty library", () => {
    const { html, omitted } = buildBookmarksHtml([], exportedAt);

    expect(omitted).toBe(0);
    expect(html).toContain("<DL><p>");
    expect(html).not.toContain("<A HREF");
  });
});

describe("exportFileName", () => {
  it("dates the file so successive exports do not overwrite each other", () => {
    expect(exportFileName("json", exportedAt)).toBe("cielo-2026-09-19.json");
    expect(exportFileName("html", exportedAt)).toBe("cielo-bookmarks-2026-09-19.html");
  });
});
