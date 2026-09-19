import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Replace semantics — the lists sent become the item's sections/tags, which is
// what the detail panel's chip editor needs. Omitted lists are left alone.
const updateItemSchema = z.object({
  sectionIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
});

export const GET = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const item = await itemService.get(user.id, id);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(serializeItem(item));
});

export const PATCH = withAuth<RouteContext>(async (request, context, user) => {
  const body = updateItemSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await context.params;
  const item = await itemService.setSectionsAndTags(user.id, id, body.data);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(serializeItem(item));
});

/**
 * Deleting one item runs through the same path as a bulk delete, so it comes
 * back with the same `restorable` snapshot and the same undo. One delete
 * mechanism, one undo — see DELETE /api/items.
 */
export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const { deleted, restorable } = await itemService.removeMany(user.id, [id]);

  if (deleted === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted, restorable });
});
