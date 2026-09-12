"use client";

import type { SerializedItem } from "@/lib/items/serialize";
import { sourceLabel, toSourcePlatform } from "@/lib/items/platform";
import { SourceBadge } from "./source-badge";

/**
 * Feed card (Figma "Card", node 56:16). The badge is always visible; the title
 * and source ride in on hover behind a bottom gradient scrim.
 *
 * Thumbnails are hotlinked straight from the source CDN rather than passed
 * through next/image — the MVP plan's cost strategy depends on not proxying
 * them, and the hosts are arbitrary so remotePatterns can't enumerate them.
 */
export function ItemCard({
  item,
  onOpen,
}: {
  item: SerializedItem;
  onOpen?: (id: string) => void;
}) {
  const label = sourceLabel(item.url);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item.id)}
      className="group masonry-item bg-thumb rounded-card relative block w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- hotlinked, see above
        <img
          src={item.thumbnailUrl}
          alt={item.title ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="block h-auto w-full"
        />
      ) : (
        <span className="block w-full" style={{ aspectRatio: 4 / 5 }} />
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[165px] bg-gradient-to-b from-transparent to-black/[0.88] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />

      <span className="pointer-events-none absolute inset-x-3.5 bottom-3.5 flex translate-y-1 flex-col gap-[3px] opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        {item.title && (
          <span className="truncate text-sm leading-[18px] font-medium text-white">
            {item.title}
          </span>
        )}
        {label && <span className="truncate text-[11px] text-white/70">{label}</span>}
      </span>

      <span className="absolute top-3 left-3">
        <SourceBadge source={toSourcePlatform(item.sourcePlatform)} />
      </span>
    </button>
  );
}
