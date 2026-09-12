import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";

interface RouteContext {
  params: Promise<{ batch: string }>;
}

/** Undo one import: removes only what that run created. */
export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { batch } = await context.params;

  const result = await itemService.undoImport(user.id, batch);

  return NextResponse.json(result);
});
