import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";

/** Chunk ceiling. The client batches; this keeps one request bounded. */
const MAX_ENTRIES = 500;

const importSchema = z.object({
  entries: z
    .array(
      z.object({
        url: z.string().trim().min(1),
        title: z.string().nullable().optional().default(null),
        folder: z.string().nullable().optional().default(null),
        // Only the extension supplies this: a logged-in saves page renders
        // thumbnails the server could never fetch.
        thumbnailUrl: z.string().nullable().optional().default(null),
        tags: z.array(z.string()).optional().default([]),
        savedAt: z.iso.datetime().nullable().optional().default(null),
      }),
    )
    .min(1)
    .max(MAX_ENTRIES),
});

export const POST = withAuth(async (request, _context, user) => {
  const body = importSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await itemService.importMany(user.id, body.data.entries);

  return NextResponse.json(result);
});
