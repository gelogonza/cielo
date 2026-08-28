import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { sectionService } from "@/lib/sections/section-service";

const createSectionSchema = z.object({ name: z.string().trim().min(1) });

export const GET = withAuth(async (_request, _context, user) => {
  const sections = await sectionService.list(user.id);
  return NextResponse.json({ sections });
});

export const POST = withAuth(async (request, _context, user) => {
  const body = createSectionSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const section = await sectionService.create(user.id, body.data.name);
  return NextResponse.json(section, { status: 201 });
});
