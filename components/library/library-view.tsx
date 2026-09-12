"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { SerializedItem } from "@/lib/items/serialize";
import { FeedSkeleton } from "./card-skeleton";
import { ItemCard } from "./item-card";
import { ItemDetailOverlay } from "./item-detail";
import { SaveModal } from "./save-modal";
import { SearchField } from "./search-field";
import { Sidebar, type SidebarSection, type SidebarTag } from "./sidebar";

export interface LibraryPage {
  items: SerializedItem[];
  nextCursor: string | null;
}

/** Library — Figma node 1:3. Sidebar plus a four-column masonry feed. */
export function LibraryView({
  generalCount,
  sections,
  tags,
  initialPage,
}: {
  generalCount: number;
  sections: SidebarSection[];
  tags: SidebarTag[];
  initialPage: LibraryPage;
}) {
  const router = useRouter();

  const [items, setItems] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards against a second fetch firing while one is already in flight —
  // the sentinel can re-enter the viewport before state settles.
  const inFlight = useRef(false);

  const buildQuery = useCallback(
    (filter: { sectionId: string | null; tagId: string | null }, nextCursor?: string | null) => {
      const params = new URLSearchParams();
      if (filter.sectionId) params.set("sectionId", filter.sectionId);
      if (filter.tagId) params.set("tagId", filter.tagId);
      if (nextCursor) params.set("cursor", nextCursor);
      return params.toString();
    },
    [],
  );

  // Filters load from the event that changed them rather than from an effect,
  // so the server-rendered first page is never discarded on mount.
  const applyFilter = useCallback(
    async (sectionId: string | null, tagId: string | null) => {
      setActiveSectionId(sectionId);
      setActiveTagId(tagId);
      setIsLoading(true);
      // Drop the previous section's items straight away: leaving them up while
      // the new ones load shows content that does not belong to the filter the
      // sidebar is already highlighting.
      setItems([]);
      setCursor(null);

      try {
        const response = await fetch(`/api/items?${buildQuery({ sectionId, tagId })}`);
        if (!response.ok) return;

        const page: LibraryPage = await response.json();
        setItems(page.items);
        setCursor(page.nextCursor);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/items?${buildQuery({ sectionId: activeSectionId, tagId: activeTagId }, cursor)}`,
      );
      if (!response.ok) return;

      const page: LibraryPage = await response.json();
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [cursor, buildQuery, activeSectionId, activeTagId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, cursor]);

  const openItem = items.find((item) => item.id === openItemId) ?? null;

  async function updateItem(id: string, input: { sectionIds?: string[]; tagNames?: string[] }) {
    const response = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) return;

    const updated: SerializedItem = await response.json();
    setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    router.refresh();
  }

  async function deleteItem(id: string) {
    const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!response.ok) return;

    setItems((current) => current.filter((item) => item.id !== id));
    setOpenItemId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-5 sm:gap-8 sm:px-[29px] sm:pt-[37px]">
        <Logo className="size-14 sm:size-[94px]" />

        <div className="order-last w-full sm:order-none sm:flex sm:flex-1 sm:justify-center">
          <SearchField />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SignOutButton />

          <button
            type="button"
            onClick={() => setIsSaveOpen(true)}
            className="bg-accent text-accent-contrast flex h-11 w-24 items-center justify-center rounded-full text-base font-medium transition hover:brightness-95 sm:h-[55px] sm:w-[157px] sm:text-xl"
          >
            Save
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-start gap-5 px-4 pt-5 pb-12 sm:px-9 lg:flex-row lg:gap-10 lg:pt-[29px] lg:pb-16">
        <Sidebar
          generalCount={generalCount}
          sections={sections}
          tags={tags}
          activeSectionId={activeSectionId}
          activeTagId={activeTagId}
          onSelectSection={(id) => void applyFilter(id, null)}
          onSelectTag={(id) => void applyFilter(activeSectionId, activeTagId === id ? null : id)}
          onSectionsChanged={() => router.refresh()}
        />

        <div className="w-full min-w-0 flex-1">
          {items.length === 0 && !isLoading ? (
            <p className="text-muted pt-4 text-base">
              Nothing saved here yet. Use the Save button, or the Cielo extension on any page.
            </p>
          ) : (
            <div
              aria-busy={isLoading}
              className="columns-2 gap-3 [column-fill:balance] sm:gap-5 lg:columns-3 xl:columns-4"
            >
              {items.map((item) => (
                <div key={item.id} className="mb-3 sm:mb-5">
                  <ItemCard item={item} onOpen={setOpenItemId} />
                </div>
              ))}

              {/* Switching section clears the feed, so the skeletons stand in
                  for the whole grid; paging keeps the results already shown
                  and only hints at what is arriving. */}
              {isLoading && (
                <FeedSkeleton count={items.length === 0 ? 12 : 4} offset={items.length} />
              )}
            </div>
          )}

          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
        </div>
      </div>

      {openItem && (
        <ItemDetailOverlay
          item={openItem}
          allSections={sections}
          onClose={() => setOpenItemId(null)}
          onUpdate={(input) => updateItem(openItem.id, input)}
          onDelete={() => deleteItem(openItem.id)}
        />
      )}

      {isSaveOpen && (
        <SaveModal
          sections={sections}
          onClose={() => setIsSaveOpen(false)}
          onSaved={(item) => {
            setIsSaveOpen(false);
            setItems((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
