// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { bookmarksHtmlChunks, type BookmarkFolder } from "@/lib/export/build-export";
import { parseBookmarkFile } from "@/lib/import/parse-bookmarks";
import type { SerializedItem } from "@/lib/items/serialize";

/**
 * The promise the export makes is that you can leave and come back. Cielo's own
 * importer is the strictest reader we control, so exporting and re-parsing is
 * the check that the file is real and not just plausible-looking.
 */
const exportedAt = new Date("2026-09-19T12:00:00.000Z");

const library: SerializedItem[] = [
  {
    id: "item-1",
    url: "https://mymind.com",
    title: "mymind",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK",
    sourceType: "WEB",
    sourcePlatform: "web",
    savedAt: "2026-09-12T10:00:00.000Z",
    sections: [{ id: "s1", name: "Inspo" }],
    tags: [
      { id: "t1", name: "design" },
      { id: "t2", name: "tools" },
    ],
    note: "the reference for this whole project",
  },
  {
    id: "item-2",
    url: "https://example.com/type?a=1&b=2",
    title: "Type specimens & more",
    body: null,
    thumbnailUrl: null,
    contentType: "LINK",
    sourceType: "WEB",
    sourcePlatform: "web",
    savedAt: "2026-08-01T08:30:00.000Z",
    sections: [],
    tags: [],
    note: null,
  },
];

async function* stream<T>(values: T[]): AsyncGenerator<T> {
  for (const value of values) {
    yield value;
  }
}

/** Mirrors how the route groups the library: unfiled first, then sections. */
const folders: BookmarkFolder[] = [
  { name: null, items: stream(library.filter((i) => i.sections.length === 0)) },
  { name: "Inspo", items: stream(library.filter((i) => i.sections.length > 0)) },
];

async function build() {
  let html = "";

  for await (const chunk of bookmarksHtmlChunks(stream(folders), { exportedAt })) {
    html += chunk;
  }

  return parseBookmarkFile(html, "cielo-bookmarks-2026-09-19.html");
}

describe("export → import round trip", async () => {
  const parsed = await build();

  // The importer runs every href through `new URL().href`, which adds the
  // empty path a bare origin omits. Items are stored with whatever URL they
  // were saved with, so the two spellings can differ across a round trip.
  const find = (needle: string) => parsed.bookmarks.find((b) => b.url.includes(needle));

  it("finds every link back, and skips nothing", () => {
    expect(parsed.bookmarks).toHaveLength(2);
    expect(parsed.skipped).toBe(0);
  });

  it("brings the section back as a folder", () => {
    expect(parsed.folders).toEqual(["Inspo"]);
    expect(find("mymind.com")?.folder).toBe("Inspo");
  });

  it("leaves an unfiled item unfiled rather than inventing a section", () => {
    const unfiled = find("example.com");
    expect(unfiled?.folder).toBeNull();
  });

  it("brings tags back", () => {
    expect(find("mymind.com")?.tags).toEqual([
      "design",
      "tools",
    ]);
  });

  it("preserves the original save time, not the export time", () => {
    expect(find("mymind.com")?.savedAt).toBe(
      "2026-09-12T10:00:00.000Z",
    );
  });

  it("survives ampersands and markup in titles and urls", () => {
    const escaped = find("example.com");

    expect(escaped?.url).toBe("https://example.com/type?a=1&b=2");
    expect(escaped?.title).toBe("Type specimens & more");
  });
});
