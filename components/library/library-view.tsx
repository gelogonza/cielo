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
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Guards against a second fetch firing while one is already in flight —
  // the sentinel can re-enter the viewport before state settles.
  const inFlight = useRef(false);

  /**
   * Search and the sidebar filters are alternatives, not combinations:
   * /api/search has no section parameter, and a query is a whole-library
   * question. A search therefore replaces whatever filter was active.
   */
  const buildUrl = useCallback(
    (
      filter: { sectionId: string | null; tagId: string | null; q: string },
      nextCursor?: string | null,
    ) => {
      const params = new URLSearchParams();

      if (filter.q) {
        params.set("q", filter.q);
      } else {
        if (filter.sectionId) params.set("sectionId", filter.sectionId);
        if (filter.tagId) params.set("tagId", filter.tagId);
      }

      if (nextCursor) params.set("cursor", nextCursor);

      return `${filter.q ? "/api/search" : "/api/items"}?${params.toString()}`;
    },
    [],
  );

  // Filters load from the event that changed them rather than from an effect,
  // so the server-rendered first page is never discarded on mount.
  const load = useCallback(
    async (sectionId: string | null, tagId: string | null, nextQuery: string) => {
      setActiveSectionId(sectionId);
      setActiveTagId(tagId);
      setQuery(nextQuery);
      setIsLoading(true);
      // Drop the previous section's items straight away: leaving them up while
      // the new ones load shows content that does not belong to the filter the
      // sidebar is already highlighting.
      setItems([]);
      setCursor(null);

      try {
        const response = await fetch(buildUrl({ sectionId, tagId, q: nextQuery }));
        if (!response.ok) return;

        const page: LibraryPage = await response.json();
        setItems(page.items);
        setCursor(page.nextCursor);
      } finally {
        setIsLoading(false);
      }
    },
    [buildUrl],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(
        buildUrl({ sectionId: activeSectionId, tagId: activeTagId, q: query }, cursor),
      );
      if (!response.ok) return;

      const page: LibraryPage = await response.json();
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [cursor, buildUrl, activeSectionId, activeTagId, query]);

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

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function leaveSelection() {
    setIsSelecting(false);
    setSelectedIds([]);
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) return;

      const removed = new Set(selectedIds);
      setItems((current) => current.filter((item) => !removed.has(item.id)));
      leaveSelection();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
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
          <SearchField onSearch={(next) => void load(null, null, next)} />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => (isSelecting ? leaveSelection() : setIsSelecting(true))}
            className="text-muted hover:text-primary-text h-11 rounded-full px-3 text-sm transition"
          >
            {isSelecting ? "Cancel" : "Select"}
          </button>
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
          onSelectSection={(id) => void load(id, null, "")}
          onSelectTag={(id) => void load(activeSectionId, activeTagId === id ? null : id, "")}
          onSectionsChanged={() => router.refresh()}
        />

        <div className="w-full min-w-0 flex-1">
          {items.length === 0 && !isLoading ? (
            <p className="text-muted pt-4 text-base">
              {query
                ? `Nothing matches “${query}”.`
                : "Nothing saved here yet. Use the Save button, or the Cielo extension on any page."}
            </p>
          ) : (
            <div
              aria-busy={isLoading}
              className="columns-2 gap-3 [column-fill:balance] sm:gap-5 lg:columns-3 xl:columns-4"
            >
              {items.map((item) => (
                <div key={item.id} className="mb-3 sm:mb-5">
                  <ItemCard
                    item={item}
                    onOpen={setOpenItemId}
                    selectable={isSelecting}
                    selected={selectedIds.includes(item.id)}
                    onToggleSelect={toggleSelected}
                  />
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

      {/* Floating bar rather than a header row: it only exists while selecting,
          and it stays reachable however far down the feed you are. */}
      {isSelecting && (
        <div
          role="status"
          className="border-line bg-surface fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border py-2 pr-2 pl-5 shadow-[0_8px_30px_rgba(18,18,18,0.12)]"
        >
          <span className="text-sm">
            {selectedIds.length === 0 ? "Pick items to delete" : `${selectedIds.length} selected`}
          </span>
          <button
            type="button"
            onClick={leaveSelection}
            className="text-muted hover:text-primary-text h-9 rounded-full px-3 text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isDeleting}
            onClick={() => void deleteSelected()}
            className="h-9 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

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
