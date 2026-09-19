import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { itemService } from "@/lib/items/item-service";
import { normalizeUrl } from "@/lib/url/normalize-url";

const CONTENT_TYPES = ["LINK", "IMAGE", "VIDEO", "CAROUSEL", "TEXT"] as const;
const SOURCE_PLATFORMS = ["tiktok", "instagram", "x", "web"] as const;

const saveLinkSchema = z
  .object({
    // Nullable so a highlight can be saved without a source page; every other
    // kind of save still needs one. Stored in normal form, so the same address
    // spelled two ways is one item — see lib/url/normalize-url.ts.
    url: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .default(null)
      .refine((value) => value === null || normalizeUrl(value) !== null, {
        message: "url must be an http(s) address",
      })
      .transform((value) => (value === null ? null : normalizeUrl(value))),
    title: z.string().nullable().optional().default(null),
    // The captured text of a highlight (contentType TEXT).
    body: z.string().trim().min(1).nullable().optional().default(null),
    thumbnailUrl: z.string().nullable().optional().default(null),
    contentType: z.enum(CONTENT_TYPES),
    sourcePlatform: z.enum(SOURCE_PLATFORMS).nullable().optional().default(null),
    sectionIds: z.array(z.string()).optional().default([]),
    tagNames: z.array(z.string()).optional().default([]),
  })
  .refine((value) => Boolean(value.url) || value.contentType === "TEXT", {
    message: "url is required unless contentType is TEXT",
    path: ["url"],
  })
  .refine((value) => value.contentType !== "TEXT" || Boolean(value.body), {
    message: "body is required when contentType is TEXT",
    path: ["body"],
  });

export const POST = withAuth(async (request, _context, user) => {
  const raw = await request.json();
  const body = saveLinkSchema.safeParse(raw);

  if (!body.success) {
    // api-contract.md distinguishes 400 (missing url) from 422 (invalid
    // contentType) — 422 only when contentType is the sole problem.
    const isContentTypeOnly = body.error.issues.every((issue) => issue.path[0] === "contentType");

    // Zod skips the object-level refinements once a field fails, so a missing
    // url alongside a bad contentType would otherwise look contentType-only
    // and answer 422. A missing url is a 400 either way.
    const urlMissing = !raw?.url && raw?.contentType !== "TEXT";

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: isContentTypeOnly && !urlMissing ? 422 : 400 },
    );
  }

  const { item, reused } = await itemService.saveLink(user.id, body.data);

  return NextResponse.json(
    {
      id: item.id,
      url: item.url,
      title: item.title,
      body: item.body,
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
