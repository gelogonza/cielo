import type { SerializedItem } from "@/lib/items/serialize";

/**
 * Builds the two files behind GET /api/export.
 *
 * A private library you cannot get out of is not private, it is captive — so
 * export is a first-class feature, not a settings-page afterthought. Two
 * formats, for two different reasons:
 *
 *  - **JSON** is lossless. Everything Cielo knows about an item survives it,
 *    including highlights that have no URL and notes that no bookmark format
 *    has a field for. This is the archive copy.
 *  - **Netscape bookmark HTML** is what every other tool can read. It is lossy
 *    by construction, but it means leaving Cielo is a drag-and-drop away.
 *
 * Both are written as a stream of string chunks over an async iterable of
 * items, so a library of any size costs one page of rows in memory rather than
 * the whole file. They are pure — the tests feed them arrays.
 */

/** Bumped only if the JSON shape changes incompatibly. */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * The archive copy.
 *
 * `itemCount` is written in the header, before any item, so a reader knows how
 * much to expect — which means the caller counts first. That is one cheap
 * query against an index, and it is worth it for a file whose whole job is to
 * be trustworthy.
 */
export async function* jsonExportChunks(
  items: AsyncIterable<SerializedItem>,
  meta: { exportedAt: Date; itemCount: number },
): AsyncGenerator<string> {
  yield [
    "{",
    `  "format": "cielo-export",`,
    `  "version": ${EXPORT_FORMAT_VERSION},`,
    `  "exportedAt": ${JSON.stringify(meta.exportedAt.toISOString())},`,
    `  "itemCount": ${meta.itemCount},`,
    `  "items": [`,
  ].join("\n");

  let written = 0;

  for await (const item of items) {
    yield (written === 0 ? "\n" : ",\n") + indent(JSON.stringify(item, null, 2), 4);
    written += 1;
  }

  yield written === 0 ? "]\n}\n" : "\n  ]\n}\n";
}

/** One folder of the bookmark file. `name` is null for unfiled items. */
export interface BookmarkFolder {
  name: string | null;
  items: AsyncIterable<SerializedItem>;
}

/**
 * Netscape bookmark HTML, one folder per section.
 *
 * The caller decides what the folders are and in what order, because that is
 * the part that needs the database: unfiled items first, then a query per
 * section. An item in two sections is therefore written under both — and
 * re-importing it reunites the copies rather than duplicating the item, which
 * is the behaviour `importMany` already has.
 *
 * Items with no URL (a highlight saved with no source) cannot be an `<A HREF>`
 * and are skipped; the JSON export is the one that keeps them.
 */
export async function* bookmarksHtmlChunks(
  folders: AsyncIterable<BookmarkFolder>,
  meta: { exportedAt: Date },
): AsyncGenerator<string> {
  yield [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- Exported from Cielo. This file can be re-imported here or into any",
    "     browser or bookmarking tool that reads bookmark exports. -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    "",
  ].join("\n");

  for await (const folder of folders) {
    // Unfiled items sit at the top level, matching how a browser export puts
    // loose bookmarks outside any folder.
    if (folder.name === null) {
      for await (const item of folder.items) {
        const line = anchor(item, "    ");
        if (line) yield `${line}\n`;
      }

      continue;
    }

    yield `    <DT><H3 ADD_DATE="${seconds(meta.exportedAt)}">${escapeText(folder.name)}</H3>\n`;
    yield "    <DL><p>\n";

    for await (const item of folder.items) {
      const line = anchor(item, "        ");
      if (line) yield `${line}\n`;
    }

    yield "    </DL><p>\n";
  }

  yield "</DL><p>\n";
}

/** Null when the item cannot be a link, so the caller can skip the line. */
function anchor(item: SerializedItem, indentation: string): string | null {
  if (!item.url) {
    return null;
  }

  const attributes = [
    `HREF="${escapeAttribute(item.url)}"`,
    `ADD_DATE="${seconds(new Date(item.savedAt))}"`,
  ];

  if (item.tags.length > 0) {
    attributes.push(`TAGS="${escapeAttribute(item.tags.map((tag) => tag.name).join(","))}"`);
  }

  // Falling back to the URL keeps the link readable in tools that show only
  // the anchor text.
  const label = item.title?.trim() || item.url;
  let line = `${indentation}<DT><A ${attributes.join(" ")}>${escapeText(label)}</A>`;

  // <DD> is the format's note field. Cielo's own importer ignores it, but
  // browsers and most read-later tools show it.
  const description = [item.note, item.body].find((value) => value?.trim());

  if (description) {
    line += `\n${indentation}<DD>${escapeText(collapse(description))}`;
  }

  return line;
}

/** Re-indents a pretty-printed value so it sits inside the `items` array. */
function indent(value: string, spaces: number): string {
  const padding = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => padding + line)
    .join("\n");
}

/** Bookmark exports record whole seconds, not milliseconds. */
function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** A <DD> ends at the next newline, so a multi-line note has to be flattened. */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

/**
 * Turns the chunks into a response body.
 *
 * `cancel` closes the generator, which stops the database walk when the person
 * navigates away mid-download instead of paging through the rest of a library
 * nobody is waiting for.
 */
export function textStream(chunks: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = chunks[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(value));
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}

/** `cielo-2026-09-19.json` — dated, so successive exports do not collide. */
export function exportFileName(format: "json" | "html", exportedAt: Date): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return format === "json" ? `cielo-${day}.json` : `cielo-bookmarks-${day}.html`;
}
