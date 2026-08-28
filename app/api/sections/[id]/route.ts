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
  const section = await sectionService.rename(user.id, id, body.data.name);

  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  return NextResponse.json(section);
});

export const DELETE = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const deleted = await sectionService.remove(user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
