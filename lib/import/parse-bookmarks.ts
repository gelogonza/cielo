/**
 * Parses an exported bookmark file into items ready for import.
 *
 * Two formats cover almost everything people actually have:
 *
 *  - **Netscape bookmark HTML** — what Chrome, Safari, Firefox, Edge, Pocket
 *    and Instapaper all export. Notoriously malformed (unclosed `<DT>`, stray
 *    `<p>`), so it is parsed with a real HTML parser rather than regex.
 *  - **CSV** — Raindrop and a few others. Columns are matched by header name
 *    because nobody agrees on their order.
 *
 * Parsing happens in the browser: the file never leaves the machine until the
 * user confirms, the preview is instant, and the upload can be chunked.
 */
export interface ParsedBookmark {
  url: string;
  title: string | null;
  /** Folder path from the export, joined with " / ". Becomes a section. */
  folder: string | null;
  tags: string[];
  /** Original save time, when the export recorded one. */
  savedAt: string | null;
}

export interface ParseResult {
  bookmarks: ParsedBookmark[];
  /** Distinct folder names, in first-seen order. */
  folders: string[];
  /** Entries that had no usable URL, so the UI can be honest about the count. */
  skipped: number;
}

export function parseBookmarkFile(text: string, fileName = ""): ParseResult {
  const looksLikeCsv =
    /\.csv$/i.test(fileName) || (!/<a\s/i.test(text) && text.includes(","));

  return looksLikeCsv ? parseCsv(text) : parseNetscapeHtml(text);
}

function toResult(bookmarks: ParsedBookmark[], skipped: number): ParseResult {
  const folders: string[] = [];

  for (const bookmark of bookmarks) {
    if (bookmark.folder && !folders.includes(bookmark.folder)) {
      folders.push(bookmark.folder);
    }
  }

  return { bookmarks, folders, skipped };
}

/** Only http(s) is savable; exports are full of javascript: and place: junk. */
function usableUrl(href: string | null | undefined): string | null {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Exports record seconds; Date wants milliseconds. */
function toIso(addDate: string | null | undefined): string | null {
  if (!addDate) {
    return null;
  }

  const seconds = Number.parseInt(addDate, 10);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitTags(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseNetscapeHtml(text: string): ParseResult {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const bookmarks: ParsedBookmark[] = [];
  let skipped = 0;

  for (const anchor of Array.from(doc.querySelectorAll("a"))) {
    const url = usableUrl(anchor.getAttribute("href"));

    if (!url) {
      skipped += 1;
      continue;
    }

    bookmarks.push({
      url,
      title: anchor.textContent?.trim() || null,
      folder: folderPathOf(anchor),
      tags: splitTags(anchor.getAttribute("tags")),
      savedAt: toIso(anchor.getAttribute("add_date")),
    });
  }

  return toResult(bookmarks, skipped);
}

/**
 * Walks up the nested `<DL>` lists an export uses for folders, collecting the
 * `<H3>` that titles each one. The top-level "Bookmarks"/"Bookmarks bar"
 * wrapper is dropped — it describes the export, not a folder the user made.
 */
function folderPathOf(anchor: Element): string | null {
  const path: string[] = [];
  let node: Element | null = anchor.closest("dl");

  while (node) {
    const heading = previousHeading(node);

    if (heading) {
      path.unshift(heading);
    }

    node = node.parentElement?.closest("dl") ?? null;
  }

  const meaningful = path.filter(
    (name) => !/^bookmarks( bar| menu| toolbar)?$/i.test(name) && name !== "",
  );

  return meaningful.length > 0 ? meaningful.join(" / ") : null;
}

function previousHeading(list: Element): string | null {
  let sibling = list.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === "H3") {
      return sibling.textContent?.trim() ?? null;
    }

    // Chrome wraps each folder in <DT><H3>…</H3><DL>…</DL>, so the heading can
    // be the parent's first child rather than a sibling of the list.
    const nested = sibling.querySelector?.("h3");

    if (nested) {
      return nested.textContent?.trim() ?? null;
    }

    sibling = sibling.previousElementSibling;
  }

  const parentHeading = list.parentElement?.querySelector("h3");
  return parentHeading?.textContent?.trim() ?? null;
}

function parseCsv(text: string): ParseResult {
  const rows = splitCsvRows(text);

  if (rows.length === 0) {
    return toResult([], 0);
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const at = (...names: string[]) => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index !== -1) return index;
    }
    return -1;
  };

  const columns = {
    url: at("url", "link", "href"),
    title: at("title", "name"),
    folder: at("folder", "collection"),
    tags: at("tags", "labels"),
    created: at("created", "date", "add_date", "timestamp"),
  };

  if (columns.url === -1) {
    return toResult([], rows.length - 1);
  }

  const bookmarks: ParsedBookmark[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const url = usableUrl(row[columns.url]);

    if (!url) {
      skipped += 1;
      continue;
    }

    const created = columns.created === -1 ? null : row[columns.created]?.trim();
    const parsedDate = created ? new Date(created) : null;

    bookmarks.push({
      url,
      title: (columns.title === -1 ? "" : (row[columns.title] ?? "")).trim() || null,
      folder: (columns.folder === -1 ? "" : (row[columns.folder] ?? "")).trim() || null,
      tags: columns.tags === -1 ? [] : splitTags(row[columns.tags]),
      savedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
    });
  }

  return toResult(bookmarks, skipped);
}

/** Minimal RFC4180 reader — quoted fields may contain commas and newlines. */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
