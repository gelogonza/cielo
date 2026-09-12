import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const noteSchema = z.object({ body: z.string() });

export const PUT = withAuth<RouteContext>(async (request, context, user) => {
  const parsed = noteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await context.params;
  const note = await itemService.setNote(user.id, id, parsed.data.body);

  if (!note) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: note.id,
    itemId: note.itemId,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  });
});

export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const removed = await itemService.removeNote(user.id, id);

  if (!removed) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
