import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";
import { createClient } from "@/lib/supabase/server";
import { ITEM_IMAGES_BUCKET, ownsObjectKey } from "@/lib/storage/item-images";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/items/:id/image — serves a directly-uploaded image.
 *
 * The bucket is private, so the alternative was a signed URL. Signed URLs
 * expire, which is the exact failure mode that makes imported Instagram and
 * TikTok thumbnails go blank after a few days — the last thing to reproduce
 * for the images Cielo actually holds. This URL never changes and is checked
 * against the session on every request.
 */
export const GET = withAuth<RouteContext>(async (_request, context, user) => {
  const { id } = await context.params;
  const item = await itemService.get(user.id, id);

  if (!item?.thumbnailUrl || item.sourceType !== "DIRECT") {
    return NextResponse.json({ error: "No image for that item" }, { status: 404 });
  }

  // Belt and braces: the row is the user's, so the key should be too, but a
  // mismatched row would otherwise read across the bucket.
  if (!ownsObjectKey(user.id, item.thumbnailUrl)) {
    return NextResponse.json({ error: "No image for that item" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .download(item.thumbnailUrl);

  if (error || !data) {
    return NextResponse.json({ error: "Image is missing from storage" }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // The object is immutable — a new upload gets a new uuid — but it is
      // still the user's private image, so no shared cache may hold it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
