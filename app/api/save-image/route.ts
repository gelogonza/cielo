import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";
import { ownsObjectKey } from "@/lib/storage/item-images";

const saveImageSchema = z.object({
  objectKey: z.string().trim().min(1),
  title: z.string().trim().min(1).nullable().optional().default(null),
  contentType: z.enum(["IMAGE", "VIDEO"]),
  sectionIds: z.array(z.string()).optional().default([]),
  tagNames: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/save-image — the confirm half of a direct upload.
 *
 * The file itself never passes through here. The browser uploads it to the
 * `item-images` bucket with the user's own session, under a path only they can
 * write, and then tells us the key. See docs/api-contract.md.
 */
export const POST = withAuth(async (request, _context, user) => {
  const body = saveImageSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // The key comes from the request, so it is checked here as well as by the
  // storage policy — the object and the row are written by two systems, and
  // only this side decides which item points at which path.
  if (!ownsObjectKey(user.id, body.data.objectKey)) {
    return NextResponse.json({ error: "That is not your upload" }, { status: 403 });
  }

  const item = await itemService.saveUpload(user.id, body.data);

  return NextResponse.json(serializeItem(item), { status: 201 });
});
