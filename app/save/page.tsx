import { redirect } from "next/navigation";
import { ShareSaveForm } from "@/components/save/share-save-form";
import { getSessionUser } from "@/lib/auth/session";
import { sectionService } from "@/lib/sections/section-service";
import { extractSharedLink } from "@/lib/share/shared-link";

/**
 * Target of the OS share sheet (see app/manifest.ts) and the paste-a-link
 * fallback for browsers that cannot register a share target — iOS Safari
 * chiefly. Mobile-first: this is the one screen most likely to be opened
 * from a phone.
 */
export default async function SavePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  if (!user) {
    // Preserve the shared link across the login round-trip, or it is lost.
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
    ).toString();

    redirect(`/login?next=${encodeURIComponent(`/save${query ? `?${query}` : ""}`)}`);
  }

  const [sections, shared] = [await sectionService.list(user.id), extractSharedLink(params)];

  return <ShareSaveForm sections={sections} shared={shared} />;
}
