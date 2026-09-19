import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";

const CONTENT_TYPES = ["LINK", "IMAGE", "VIDEO", "CAROUSEL", "TEXT"] as const;
const SOURCE_TYPES = ["WEB", "DIRECT"] as const;

/** Matches the ceiling on DELETE /api/items — a restore undoes one delete. */
const MAX_ITEMS = 500;

const restoreSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().nullable(),
        title: z.string().nullable(),
        body: z.string().nullable(),
        thumbnailUrl: z.string().nullable(),
        contentType: z.enum(CONTENT_TYPES),
        sourceType: z.enum(SOURCE_TYPES),
        sourcePlatform: z.string().nullable(),
        savedAt: z.iso.datetime(),
        importBatch: z.string().nullable(),
        sectionIds: z.array(z.string()),
        tagIds: z.array(z.string()),
        note: z.string().nullable(),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
});

/**
 * POST /api/items/restore — undo of a bulk delete.
 *
 * The body is the `restorable` snapshot that `DELETE /api/items` handed back,
 * so undo needs no server-side trash. Items come back under their original
 * ids; `userId` comes from the session, never the body, and section and tag
 * ids are filtered to ones this user owns.
 */
export const POST = withAuth(async (request, _context, user) => {
  const body = restoreSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { restored } = await itemService.restoreMany(user.id, body.data.items);

  return NextResponse.json({ restored });
});
