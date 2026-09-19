import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { sectionService } from "@/lib/sections/section-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const renameSectionSchema = z.object({ name: z.string().trim().min(1) });

export const PATCH = withAuth<RouteContext>(async (request, context, user) => {
  const body = renameSectionSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await sectionService.rename(user.id, id, body.data.name);

  if (result.status === "not-found") {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Sections are one per name per user, so this is a conflict rather than a
  // merge — same reasoning as PATCH /api/tags/:id.
  if (result.status === "conflict") {
    return NextResponse.json(
      { error: "You already have a section with that name" },
      { status: 409 },
    );
  }

  return NextResponse.json(result.section);
});

export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const deleted = await sectionService.remove(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
