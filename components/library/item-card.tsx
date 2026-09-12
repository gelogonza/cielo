"use client";

import { useState } from "react";
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
  // Set when the thumbnail cannot be shown full-bleed: it failed to load, or
  // it turned out to be a favicon-sized icon that would smear across the card.
  const [useTextCard, setUseTextCard] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(item.id)}
      className="group masonry-item bg-thumb border-line rounded-card relative block w-full overflow-hidden border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      {item.body ? (
        <QuoteCard body={item.body} label={label} />
      ) : item.thumbnailUrl && !useTextCard ? (
        // eslint-disable-next-line @next/next/no-img-element -- hotlinked, see above
        <img
          src={item.thumbnailUrl}
          alt={item.title ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          // Thumbnails are hotlinked, so they can 404 or be hotlink-blocked
          // long after the save. Fall through to the text card rather than
          // leaving a broken-image glyph in the feed.
          onError={() => setUseTextCard(true)}
          // When all a site offered was a favicon, showing it full-bleed is a
          // blurry smear. Demote it to the text card's small mark instead.
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth < MIN_FULL_BLEED_WIDTH) {
              setUseTextCard(true);
            }
          }}
          className="block h-auto w-full"
        />
      ) : (
        <TextCard item={item} label={label} iconUrl={item.thumbnailUrl} />
      )}

      {!item.body && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[165px] bg-gradient-to-b from-transparent to-black/[0.88] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}

      <span
        hidden={Boolean(item.body)}
        className="pointer-events-none absolute inset-x-3.5 bottom-3.5 flex translate-y-1 flex-col gap-[3px] opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
      >
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

/** Below this width a thumbnail is an icon, not a picture of the page. */
const MIN_FULL_BLEED_WIDTH = 200;

/**
 * Shown when a save has no usable picture. Some pages publish no image of any
 * kind, so the feed needs something deliberate to fall back to — a blank grey
 * rectangle reads as a loading failure.
 */
function TextCard({
  item,
  label,
  iconUrl,
}: {
  item: SerializedItem;
  label: string | null;
  /** A favicon-sized image, shown as a small mark rather than stretched. */
  iconUrl?: string | null;
}) {
  return (
    <span
      className="bg-thumb flex w-full flex-col justify-between gap-3 p-4"
      style={{ aspectRatio: 4 / 5 }}
    >
      <span className="flex flex-col gap-3">
        {iconUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- hotlinked, see above
          <img
            src={iconUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-8 rounded-[6px] object-contain"
          />
        )}
        <span className="text-secondary-text line-clamp-5 text-[15px] leading-[20px] font-medium">
          {item.title ?? label ?? "Untitled"}
        </span>
      </span>
      {label && <span className="text-muted truncate text-[11px]">{label}</span>}
    </span>
  );
}

/**
 * A saved highlight. Unlike the other cards this has no fixed aspect — the
 * quote sets its own height, which is what gives the masonry its rhythm.
 */
function QuoteCard({ body, label }: { body: string; label: string | null }) {
  return (
    <span className="bg-surface flex w-full flex-col gap-4 p-5">
      <span aria-hidden className="text-accent-strong -mb-2 text-2xl leading-none">
        &ldquo;
      </span>
      <span className="text-secondary-text line-clamp-[12] text-[15px] leading-[22px]">{body}</span>
      {label && <span className="text-muted truncate text-[11px]">{label}</span>}
    </span>
  );
}
