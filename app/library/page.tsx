import { redirect } from "next/navigation";
import { LibraryView } from "@/components/library/library-view";
import { getSessionUser } from "@/lib/auth/session";
import { itemService } from "@/lib/items/item-service";
import { serializeItem } from "@/lib/items/serialize";
import { sectionService } from "@/lib/sections/section-service";
import { tagService } from "@/lib/tags/tag-service";

export default async function LibraryPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // The first page is rendered on the server so the feed paints without a
  // client round-trip; subsequent pages come from GET /api/items.
  const [sections, tags, generalCount, page] = await Promise.all([
    sectionService.list(user.id),
    tagService.list(user.id),
    itemService.countAll(user.id),
    itemService.list(user.id),
  ]);

  return (
    <LibraryView
      generalCount={generalCount}
      sections={sections}
      tags={tags}
      initialPage={{ items: page.items.map(serializeItem), nextCursor: page.nextCursor }}
    />
  );
}
