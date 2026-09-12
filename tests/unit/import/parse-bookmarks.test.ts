// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseBookmarkFile } from "@/lib/import/parse-bookmarks";

/** A Chrome export, including its usual malformed unclosed tags. */
const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1600000000">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://are.na/block/1" ADD_DATE="1600000001">Are.na block</A>
    <DT><H3>Design</H3>
    <DL><p>
      <DT><A HREF="https://example.com/type" ADD_DATE="1600000002" TAGS="type,inspo">Type specimens</A>
      <DT><H3>Posters</H3>
      <DL><p>
        <DT><A HREF="https://example.com/swiss">Swiss grid</A>
      </DL><p>
    </DL><p>
  </DL><p>
  <DT><A HREF="javascript:void(0)">A bookmarklet</A>
  <DT><A HREF="place:sort=8">Firefox smart folder</A>
</DL><p>`;

describe("parseBookmarkFile — Netscape HTML", () => {
  const result = parseBookmarkFile(CHROME, "bookmarks_9_12_26.html");

  it("finds every real bookmark", () => {
    expect(result.bookmarks.map((b) => b.url)).toEqual([
      "https://are.na/block/1",
      "https://example.com/type",
      "https://example.com/swiss",
    ]);
  });

  it("skips entries that are not savable links", () => {
    // Exports are full of javascript: bookmarklets and place: smart folders.
    expect(result.skipped).toBe(2);
  });

  it("reads titles", () => {
    expect(result.bookmarks[0].title).toBe("Are.na block");
  });

  it("turns folders into a path, ignoring the export's own wrapper", () => {
    // "Bookmarks bar" describes the export, not a folder the user made.
    expect(result.bookmarks[1].folder).toBe("Design");
    expect(result.bookmarks[2].folder).toBe("Design / Posters");
  });

  it("leaves a top-level bookmark unfoldered", () => {
    expect(result.bookmarks[0].folder).toBeNull();
  });

  it("lists the distinct folders for the preview", () => {
    expect(result.folders).toEqual(["Design", "Design / Posters"]);
  });

  it("reads the TAGS attribute Firefox and Pocket write", () => {
    expect(result.bookmarks[1].tags).toEqual(["type", "inspo"]);
  });

  it("converts ADD_DATE seconds to an ISO timestamp", () => {
    expect(result.bookmarks[0].savedAt).toBe(new Date(1600000001 * 1000).toISOString());
  });

  it("reports no date when the export omitted one", () => {
    expect(result.bookmarks[2].savedAt).toBeNull();
  });

  it("handles an empty file without throwing", () => {
    expect(parseBookmarkFile("", "empty.html").bookmarks).toEqual([]);
  });
});

describe("parseBookmarkFile — CSV", () => {
  const RAINDROP = `title,url,folder,tags,created
"Poster archive, Swiss grid",https://are.na/block/1,Design,"poster,type",2026-08-12T10:00:00.000Z
Kitchen,https://example.com/kyoto,Interiors,,2026-08-11T09:00:00.000Z
Broken,not-a-url,Design,,`;

  const result = parseBookmarkFile(RAINDROP, "raindrop.csv");

  it("matches columns by header name, not position", () => {
    expect(result.bookmarks[0]).toMatchObject({
      url: "https://are.na/block/1",
      title: "Poster archive, Swiss grid",
      folder: "Design",
      tags: ["poster", "type"],
    });
  });

  it("keeps a comma inside a quoted field", () => {
    expect(result.bookmarks[0].title).toBe("Poster archive, Swiss grid");
  });

  it("parses the created date", () => {
    expect(result.bookmarks[0].savedAt).toBe("2026-08-12T10:00:00.000Z");
  });

  it("skips rows whose url is unusable", () => {
    expect(result.bookmarks).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });

  it("treats a missing tags cell as no tags", () => {
    expect(result.bookmarks[1].tags).toEqual([]);
  });

  it("returns nothing usable when there is no url column", () => {
    const noUrl = parseBookmarkFile("title,folder\nA,B", "x.csv");

    expect(noUrl.bookmarks).toEqual([]);
    expect(noUrl.skipped).toBe(1);
  });
});
