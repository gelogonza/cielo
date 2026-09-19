import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { buildBookmarksHtml, buildJsonExport, exportFileName } from "@/lib/export/build-export";
import { itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";

/**
 * GET /api/export?format=json|html
 *
 * The whole library, in one file, as an attachment. See docs/api-contract.md.
 *
 * No pagination and no cursor: a partial export is not an export. Responses
 * are always private and never cached — this is the user's entire library.
 */
export const GET = withAuth(async (request, _context, user) => {
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format !== "json" && format !== "html") {
    return NextResponse.json({ error: "format must be json or html" }, { status: 400 });
  }

  const exportedAt = new Date();
  const items = (await itemService.exportAll(user.id)).map(serializeItem);

  const body =
    format === "json"
      ? JSON.stringify(buildJsonExport(items, exportedAt), null, 2)
      : buildBookmarksHtml(items, exportedAt).html;

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        format === "json" ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(format, exportedAt)}"`,
      "Cache-Control": "no-store, private",
    },
  });
});
