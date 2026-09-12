import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { MAX_PAGE_SIZE, itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";

const querySchema = z.object({
  q: z.string().trim().min(1),
  cursor: z.iso.datetime().optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).optional(),
});

export const GET = withAuth(async (request, _context, user) => {
  const { searchParams } = new URL(request.url);

  const query = querySchema.safeParse({
    q: searchParams.get("q") ?? "",
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  // An empty query is not an error — it is the state the field starts in, so
  // answer with no results rather than a 400 the UI would have to special-case.
  if (!query.success) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { items, nextCursor } = await itemService.search(user.id, query.data);

  return NextResponse.json({ items: items.map(serializeItem), nextCursor });
});
