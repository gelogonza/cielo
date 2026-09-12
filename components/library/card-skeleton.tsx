/** Heights mirror the spread of real cards, so the grid does not jump on load. */
const HEIGHTS = [330, 240, 290, 250, 360, 260, 280, 330, 285, 230, 350, 275];

/**
 * Placeholder shown while a page of the feed is in flight. Purely decorative —
 * hidden from assistive tech, which is told about loading by the feed's own
 * aria-busy.
 */
export function CardSkeleton({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="bg-thumb border-line animate-skeleton rounded-card masonry-item w-full border"
      style={{ height }}
    />
  );
}

export function FeedSkeleton({ count = 12, offset = 0 }: { count?: number; offset?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={`skeleton-${offset + index}`} className="mb-3 sm:mb-5">
          <CardSkeleton height={HEIGHTS[(offset + index) % HEIGHTS.length]} />
        </div>
      ))}
    </>
  );
}

/** The sidebar's shape while the library's first paint is still on the server. */
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden
      className="bg-surface rounded-panel flex w-full shrink-0 flex-col gap-2 p-4 lg:h-[830px] lg:w-60 lg:px-5 lg:py-6"
    >
      <div className="bg-thumb animate-skeleton h-[46px] w-full rounded-row" />
      <div className="bg-thumb animate-skeleton mt-4 h-3 w-20 rounded-full" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="bg-thumb animate-skeleton h-[46px] w-full rounded-row" />
      ))}
    </div>
  );
}
