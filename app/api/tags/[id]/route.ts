import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { tagService } from "@/lib/tags/tag-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const renameTagSchema = z.object({ name: z.string().trim().min(1) });

export const PATCH = withAuth<RouteContext>(async (request, context, user) => {
  const body = renameTagSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await tagService.rename(user.id, id, body.data.name);

  if (result.status === "not-found") {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  // Tags are unique per user, so this is a conflict rather than a merge —
  // see TagService.rename.
  if (result.status === "conflict") {
    return NextResponse.json({ error: "You already have a tag with that name" }, { status: 409 });
  }

  return NextResponse.json(result.tag);
});

export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const deleted = await tagService.remove(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
