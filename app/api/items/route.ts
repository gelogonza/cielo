import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { MAX_PAGE_SIZE, itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";

const querySchema = z.object({
  cursor: z.iso.datetime().optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).optional(),
  sectionId: z.string().optional(),
  tagId: z.string().optional(),
});

export const GET = withAuth(async (request, _context, user) => {
  const { searchParams } = new URL(request.url);

  const query = querySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    sectionId: searchParams.get("sectionId") ?? undefined,
    tagId: searchParams.get("tagId") ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { items, nextCursor } = await itemService.list(user.id, query.data);

  return NextResponse.json({ items: items.map(serializeItem), nextCursor });
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

/**
 * Bulk delete. A DELETE with a body is unusual but correct here: the operation
 * is a deletion, and the alternative — hundreds of individual requests — is
 * worse for both the client and the database.
 */
export const DELETE = withAuth(async (request, _context, user) => {
  const body = bulkDeleteSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Scoped to the owner, so an id belonging to someone else simply does not
  // match rather than erroring — the count reports what actually went.
  const deleted = await itemService.removeMany(user.id, body.data.ids);

  return NextResponse.json({ deleted });
});
