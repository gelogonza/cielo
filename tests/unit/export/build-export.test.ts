import { describe, expect, it } from "vitest";
import {
  bookmarksHtmlChunks,
  exportFileName,
  jsonExportChunks,
  textStream,
  type BookmarkFolder,
} from "@/lib/export/build-export";
import type { SerializedItem } from "@/lib/items/serialize";

const exportedAt = new Date("2026-09-19T12:00:00.000Z");

function item(overrides: Partial<SerializedItem> = {}): SerializedItem {
  return {
    id: "item-1",
    url: "https://mymind.com/",
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

/** The builders consume async iterables; the tests hand them arrays. */
async function* stream<T>(values: T[]): AsyncGenerator<T> {
  for (const value of values) {
    yield value;
  }
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let out = "";

  for await (const chunk of chunks) {
    out += chunk;
  }

  return out;
}

function json(items: SerializedItem[], itemCount = items.length) {
  return collect(jsonExportChunks(stream(items), { exportedAt, itemCount }));
}

function html(folders: BookmarkFolder[]) {
  return collect(bookmarksHtmlChunks(stream(folders), { exportedAt }));
}

/** Everything at the top level, which is what the JSON-shaped tests want. */
function unfiled(items: SerializedItem[]): BookmarkFolder[] {
  return [{ name: null, items: stream(items) }];
}

describe("jsonExportChunks", () => {
  it("is a self-describing envelope around the wire shape", async () => {
    expect(JSON.parse(await json([item()]))).toEqual({
      format: "cielo-export",
      version: 1,
      exportedAt: "2026-09-19T12:00:00.000Z",
      itemCount: 1,
      items: [item()],
    });
  });

  it("stays valid JSON across the chunk boundaries between items", async () => {
    const parsed = JSON.parse(
      await json([item(), item({ id: "item-2" }), item({ id: "item-3" })]),
    );

    expect(parsed.items.map((i: SerializedItem) => i.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
    ]);
  });

  it("keeps items the bookmark format cannot hold", async () => {
    // A highlight with no source: no URL, so no <A HREF> — JSON is the only
    // format that does not lose it.
    const highlight = item({ url: null, title: null, body: "a line worth keeping" });

    expect(JSON.parse(await json([highlight])).items[0].body).toBe("a line worth keeping");
  });

  it("reports an empty library honestly rather than failing", async () => {
    expect(JSON.parse(await json([]))).toMatchObject({ itemCount: 0, items: [] });
  });

  it("writes the count before any item, so a reader knows what to expect", async () => {
    const text = await json([item()]);

    expect(text.indexOf('"itemCount"')).toBeLessThan(text.indexOf('"items"'));
  });
});

describe("bookmarksHtmlChunks", () => {
  it("writes a file browsers recognise", async () => {
    const text = await html(unfiled([item()]));

    expect(text.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
    expect(text).toContain('<A HREF="https://mymind.com/"');
    expect(text.trimEnd().endsWith("</DL><p>")).toBe(true);
  });

  it("records the original save time in seconds, not milliseconds", async () => {
    expect(await html(unfiled([item()]))).toContain(
      `ADD_DATE="${Date.parse("2026-09-12T10:00:00.000Z") / 1000}"`,
    );
  });

  it("writes one folder per named group", async () => {
    const text = await html([
      { name: "Inspo", items: stream([item()]) },
      { name: "Reading", items: stream([item({ id: "item-2" })]) },
    ]);

    expect(text).toContain(">Inspo</H3>");
    expect(text).toContain(">Reading</H3>");
  });

  it("leaves unfiled items at the top level", async () => {
    expect(await html(unfiled([item()]))).not.toContain("<H3");
  });

  it("writes tags in the attribute our own importer reads back", async () => {
    const text = await html(
      unfiled([
        item({
          tags: [
            { id: "t1", name: "design" },
            { id: "t2", name: "type" },
          ],
        }),
      ]),
    );

    expect(text).toContain('TAGS="design,type"');
  });

  it("omits the tags attribute entirely when there are none", async () => {
    expect(await html(unfiled([item()]))).not.toContain("TAGS=");
  });

  it("writes a note as the format's description field, flattened to one line", async () => {
    const text = await html(unfiled([item({ note: "first line\n\nsecond line" })]));

    expect(text).toContain("<DD>first line second line");
  });

  it("falls back to the highlight text when there is no note", async () => {
    expect(await html(unfiled([item({ note: null, body: "a quote" })]))).toContain("<DD>a quote");
  });

  it("falls back to the URL when an item has no title", async () => {
    expect(await html(unfiled([item({ title: null })]))).toContain(">https://mymind.com/</A>");
  });

  it("escapes markup in titles, sections and urls so the file still parses", async () => {
    const text = await html([
      {
        name: "R&D <team>",
        items: stream([
          item({
            title: '<script>alert("x")</script> & more',
            url: 'https://example.com/?a=1&b="2"',
          }),
        ]),
      },
    ]);

    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;");
    expect(text).toContain('HREF="https://example.com/?a=1&amp;b=&quot;2&quot;"');
    expect(text).toContain(">R&amp;D &lt;team&gt;</H3>");
  });

  it("skips an item it cannot represent rather than writing a broken link", async () => {
    const text = await html(
      unfiled([item(), item({ id: "item-2", url: null, body: "a source-less highlight" })]),
    );

    expect(text).not.toContain("source-less");
    expect(text.match(/<A HREF=/g)).toHaveLength(1);
  });

  it("produces a valid empty file for an empty library", async () => {
    const text = await html([{ name: null, items: stream([]) }]);

    expect(text).toContain("<DL><p>");
    expect(text).not.toContain("<A HREF");
  });
});

describe("textStream", () => {
  it("encodes the chunks as the response body", async () => {
    const body = textStream(stream(["one ", "two ", "three"]));

    expect(await new Response(body).text()).toBe("one two three");
  });

  it("stops the walk when the reader goes away mid-download", async () => {
    let pulled = 0;
    let closed = false;

    async function* counted() {
      try {
        for (;;) {
          pulled += 1;
          yield "chunk";
        }
      } finally {
        closed = true;
      }
    }

    const reader = textStream(counted()).getReader();
    await reader.read();
    await reader.cancel();

    expect(closed).toBe(true);
    // The generator is not left paging through the rest of the library.
    const seen = pulled;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pulled).toBe(seen);
  });
});

describe("exportFileName", () => {
  it("dates the file so successive exports do not overwrite each other", () => {
    expect(exportFileName("json", exportedAt)).toBe("cielo-2026-09-19.json");
    expect(exportFileName("html", exportedAt)).toBe("cielo-bookmarks-2026-09-19.html");
  });
});
