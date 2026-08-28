import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";

const CONTENT_TYPES = ["LINK", "IMAGE", "VIDEO", "CAROUSEL", "TEXT"] as const;
const SOURCE_PLATFORMS = ["tiktok", "instagram", "x", "web"] as const;

const saveLinkSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  contentType: z.enum(CONTENT_TYPES),
  sourcePlatform: z.enum(SOURCE_PLATFORMS).nullable().optional().default(null),
  sectionIds: z.array(z.string()).optional().default([]),
  tagNames: z.array(z.string()).optional().default([]),
});

export const POST = withAuth(async (request, _context, user) => {
  const body = saveLinkSchema.safeParse(await request.json());

  if (!body.success) {
    // api-contract.md distinguishes 400 (missing url) from 422 (invalid
    // contentType) — 422 only when contentType is the sole problem.
    const isContentTypeOnly = body.error.issues.every((issue) => issue.path[0] === "contentType");
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: isContentTypeOnly ? 422 : 400 },
    );
  }

  const { item, reused } = await itemService.saveLink(user.id, body.data);

  return NextResponse.json(
    {
      id: item.id,
      url: item.url,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      contentType: item.contentType,
      sourceType: item.sourceType,
      sourcePlatform: item.sourcePlatform,
      savedAt: item.savedAt,
      sections: item.sections.map(({ section }) => section),
      tags: item.tags.map(({ tag }) => tag),
      reused,
    },
    { status: 201 },
  );
});
