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
 * Both are pure functions over the wire shape, so they are tested without a
 * database.
 */

/** Bumped only if the JSON shape changes incompatibly. */
export const EXPORT_FORMAT_VERSION = 1;

export interface JsonExport {
  format: "cielo-export";
  version: number;
  exportedAt: string;
  itemCount: number;
  items: SerializedItem[];
}

export function buildJsonExport(items: SerializedItem[], exportedAt: Date): JsonExport {
  return {
    format: "cielo-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    itemCount: items.length,
    items,
  };
}

/**
 * Netscape bookmark HTML, grouped into one folder per section.
 *
 * An item in two sections is written under both. Re-importing it — here or
 * anywhere else that dedupes by URL — reunites the copies rather than
 * duplicating the item, which is the behaviour `importMany` already has.
 *
 * Items with no URL (a highlight saved with no source) cannot be an `<A HREF>`
 * and are left out; `buildBookmarksHtml` reports how many, so the UI can say so
 * instead of silently losing them.
 */
export interface BookmarksHtml {
  html: string;
  /** Items that could not be represented, because they have no URL. */
  omitted: number;
}

export function buildBookmarksHtml(items: SerializedItem[], exportedAt: Date): BookmarksHtml {
  const linkable = items.filter((item) => item.url);
  const omitted = items.length - linkable.length;

  // Section name → items, in first-seen order; "" holds everything unfiled.
  const folders = new Map<string, SerializedItem[]>([["", []]]);

  for (const item of linkable) {
    const names = item.sections.length > 0 ? item.sections.map((section) => section.name) : [""];

    for (const name of names) {
      const bucket = folders.get(name);

      if (bucket) {
        bucket.push(item);
      } else {
        folders.set(name, [item]);
      }
    }
  }

  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- Exported from Cielo. This file can be re-imported here or into any",
    "     browser or bookmarking tool that reads bookmark exports. -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
  ];

  // Unfiled items sit at the top level, matching how a browser export puts
  // loose bookmarks outside any folder.
  for (const item of folders.get("") ?? []) {
    lines.push(anchor(item, "    "));
  }

  for (const [name, bucket] of folders) {
    if (name === "") {
      continue;
    }

    lines.push(`    <DT><H3 ADD_DATE="${seconds(exportedAt)}">${escapeText(name)}</H3>`);
    lines.push("    <DL><p>");

    for (const item of bucket) {
      lines.push(anchor(item, "        "));
    }

    lines.push("    </DL><p>");
  }

  lines.push("</DL><p>", "");

  return { html: lines.join("\n"), omitted };
}

function anchor(item: SerializedItem, indent: string): string {
  const attributes = [
    `HREF="${escapeAttribute(item.url ?? "")}"`,
    `ADD_DATE="${seconds(new Date(item.savedAt))}"`,
  ];

  if (item.tags.length > 0) {
    attributes.push(`TAGS="${escapeAttribute(item.tags.map((tag) => tag.name).join(","))}"`);
  }

  // Falling back to the URL keeps the link readable in tools that show only
  // the anchor text.
  const label = item.title?.trim() || item.url || "Untitled";
  let line = `${indent}<DT><A ${attributes.join(" ")}>${escapeText(label)}</A>`;

  // <DD> is the format's note field. Cielo's own importer ignores it, but
  // browsers and most read-later tools show it.
  const description = [item.note, item.body].find((value) => value?.trim());

  if (description) {
    line += `\n${indent}<DD>${escapeText(collapse(description))}`;
  }

  return line;
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

/** `cielo-2026-09-19.json` — dated, so successive exports do not collide. */
export function exportFileName(format: "json" | "html", exportedAt: Date): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return format === "json" ? `cielo-${day}.json` : `cielo-bookmarks-${day}.html`;
}
