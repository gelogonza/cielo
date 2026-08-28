import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { tagService } from "@/lib/tags/tag-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const deleted = await tagService.remove(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
