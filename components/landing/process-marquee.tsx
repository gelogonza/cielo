import { SourceBadge, type SourcePlatform } from "@/components/library/source-badge";

interface Tile {
  source: SourcePlatform;
  /** Placeholder thumbnail tint, echoing the feed's varied card heights. */
  tint: string;
  height: number;
}

const topRow: Tile[] = [
  { source: "tiktok", tint: "#262626", height: 132 },
  { source: "instagram", tint: "#2e2e2e", height: 96 },
  { source: "x", tint: "#1f1f1f", height: 148 },
  { source: "web", tint: "#333333", height: 110 },
  { source: "upload", tint: "#242424", height: 126 },
  { source: "instagram", tint: "#292929", height: 92 },
];

const bottomRow: Tile[] = [
  { source: "web", tint: "#2b2b2b", height: 104 },
  { source: "upload", tint: "#303030", height: 140 },
  { source: "tiktok", tint: "#212121", height: 98 },
  { source: "x", tint: "#363636", height: 134 },
  { source: "web", tint: "#252525", height: 112 },
  { source: "tiktok", tint: "#2f2f2f", height: 120 },
];

/**
 * Abstract illustration of the save flow: scattered saves from every platform
 * streaming in from both directions and settling into one library.
 *
 * Each row duplicates its tiles so the translate can loop seamlessly; the
 * duplicate is aria-hidden so the row reads once to assistive tech.
 */
export function ProcessMarquee() {
  return (
    <section aria-labelledby="process-heading" className="w-full overflow-hidden py-4">
      <h2 id="process-heading" className="sr-only">
        How Cielo works
      </h2>

      <div className="marquee-mask flex flex-col gap-4">
        <MarqueeRow tiles={topRow} direction="left" />
        <MarqueeRow tiles={bottomRow} direction="right" />
      </div>

      <ol className="text-muted mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm">
        <Step>Save from any app</Step>
        <Arrow />
        <Step>One library</Step>
        <Arrow />
        <Step>Your own sections</Step>
      </ol>
    </section>
  );
}

function MarqueeRow({ tiles, direction }: { tiles: Tile[]; direction: "left" | "right" }) {
  const animation = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="flex w-full">
      <div className={`flex shrink-0 gap-4 pr-4 ${animation}`}>
        {tiles.map((tile, index) => (
          <MarqueeTile key={`a-${index}`} tile={tile} />
        ))}
      </div>
      <div aria-hidden className={`flex shrink-0 gap-4 pr-4 ${animation}`}>
        {tiles.map((tile, index) => (
          <MarqueeTile key={`b-${index}`} tile={tile} />
        ))}
      </div>
    </div>
  );
}

function MarqueeTile({ tile }: { tile: Tile }) {
  return (
    <div
      className="rounded-card relative w-28 shrink-0 sm:w-[168px]"
      style={{ background: tile.tint, height: tile.height }}
    >
      <span className="absolute top-2.5 left-2.5">
        <SourceBadge source={tile.source} />
      </span>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <li className="border-line bg-surface/60 rounded-full border px-4 py-2">{children}</li>;
}

function Arrow() {
  return (
    <li aria-hidden className="text-accent">
      →
    </li>
  );
}
