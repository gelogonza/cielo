import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { tagService } from "@/lib/tags/tag-service";

const createTagSchema = z.object({ name: z.string().trim().min(1) });

export const GET = withAuth(async (_request, _context, user) => {
  const tags = await tagService.list(user.id);
  return NextResponse.json({ tags });
});

export const POST = withAuth(async (request, _context, user) => {
  const body = createTagSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tag, created } = await tagService.findOrCreate(user.id, body.data.name);
  return NextResponse.json(tag, { status: created ? 201 : 200 });
});
