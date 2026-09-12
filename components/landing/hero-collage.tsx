import { SourceBadge, type SourcePlatform } from "@/components/library/source-badge";

interface Tile {
  ratio: number;
  /** Abstract fill. Real saves are private, so the landing never shows them. */
  fill: string;
  source?: SourcePlatform;
}

/**
 * A still masonry wall under the hero — the Pinterest/Cosmos move of letting
 * the grid itself be the argument, rather than describing it.
 *
 * The tiles are abstract gradients on purpose: a landing page must not show
 * anyone's actual library, and stock imagery would misrepresent the product.
 */
const TILES: Tile[] = [
  { ratio: 3 / 4, fill: "linear-gradient(150deg,#eef0f2,#dfe3e7)", source: "web" },
  { ratio: 1, fill: "linear-gradient(150deg,#f2f1ee,#e6e2da)", source: "instagram" },
  { ratio: 4 / 5, fill: "linear-gradient(150deg,#edf2e6,#dbe8c8)", source: "tiktok" },
  { ratio: 3 / 5, fill: "linear-gradient(150deg,#eceef1,#dde1e6)" },
  { ratio: 5 / 4, fill: "linear-gradient(150deg,#f1eef2,#e3dde7)", source: "x" },
  { ratio: 4 / 5, fill: "linear-gradient(150deg,#f2efe9,#e8e0d2)" },
  { ratio: 1, fill: "linear-gradient(150deg,#e9eef2,#d6dfe8)", source: "upload" },
  { ratio: 3 / 4, fill: "linear-gradient(150deg,#f0f2ec,#e0e6d4)" },
  { ratio: 5 / 6, fill: "linear-gradient(150deg,#eff0f2,#e1e3e7)", source: "web" },
  { ratio: 3 / 5, fill: "linear-gradient(150deg,#f2f0ee,#e7e1db)" },
  { ratio: 1, fill: "linear-gradient(150deg,#ebeff1,#d9e2e7)", source: "tiktok" },
  { ratio: 4 / 5, fill: "linear-gradient(150deg,#f1f2ee,#e4e7dc)" },
  { ratio: 3 / 4, fill: "linear-gradient(150deg,#eeeef3,#dedee8)", source: "instagram" },
  { ratio: 5 / 4, fill: "linear-gradient(150deg,#f2f1ed,#e6e2d8)" },
  { ratio: 4 / 5, fill: "linear-gradient(150deg,#edf1f2,#dae3e6)", source: "x" },
];

export function HeroCollage() {
  return (
    <div aria-hidden className="collage-fade w-full overflow-hidden px-4 sm:px-6">
      <div className="mx-auto max-w-[1240px] columns-3 gap-3 [column-fill:balance] sm:columns-4 sm:gap-4 lg:columns-5">
        {TILES.map((tile, index) => (
          <div key={index} className="mb-3 sm:mb-4">
            <div
              className="border-line relative w-full overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(18,18,18,0.04),0_10px_30px_rgba(18,18,18,0.05)]"
              style={{ aspectRatio: tile.ratio, background: tile.fill }}
            >
              {tile.source && (
                <span className="absolute top-2.5 left-2.5">
                  <SourceBadge source={tile.source} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
