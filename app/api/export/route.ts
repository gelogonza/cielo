import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import {
  bookmarksHtmlChunks,
  exportFileName,
  jsonExportChunks,
  textStream,
  type BookmarkFolder,
} from "@/lib/export/build-export";
import { itemService, type ExportScope } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";
import { sectionService } from "@/lib/sections/section-service";

/**
 * GET /api/export?format=json|html
 *
 * The whole library, in one file, as an attachment. See docs/api-contract.md.
 *
 * Streamed rather than assembled: the library is walked a page of rows at a
 * time and written out as it goes, so the response starts immediately and peak
 * memory does not track the size of the library. No pagination and no cursor on
 * the way out — a partial export is not an export. Always private, never
 * cached: this is the user's entire library.
 */
export const GET = withAuth(async (request, _context, user) => {
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format !== "json" && format !== "html") {
    return NextResponse.json({ error: "format must be json or html" }, { status: 400 });
  }

  const exportedAt = new Date();

  const body =
    format === "json"
      ? textStream(
          jsonExportChunks(serializedItems(user.id), {
            exportedAt,
            // Written in the header, before any item, so a reader knows how
            // much to expect.
            itemCount: await itemService.countAll(user.id),
          }),
        )
      : textStream(bookmarksHtmlChunks(bookmarkFolders(user.id), { exportedAt }));

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        format === "json" ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(format, exportedAt)}"`,
      "Cache-Control": "no-store, private",
    },
  });
});

async function* serializedItems(userId: string, scope?: ExportScope) {
  for await (const row of itemService.exportItems(userId, scope)) {
    yield serializeItem(row);
  }
}

/**
 * Unfiled items at the top level, then one folder per section — a query each,
 * so no part of the file needs the whole library in hand. An empty section is
 * skipped rather than written as an empty folder that would import as nothing.
 */
async function* bookmarkFolders(userId: string): AsyncGenerator<BookmarkFolder> {
  yield { name: null, items: serializedItems(userId, { unfiled: true }) };

  for (const section of await sectionService.list(userId)) {
    if (section.itemCount > 0) {
      yield { name: section.name, items: serializedItems(userId, { sectionId: section.id }) };
    }
  }
}
