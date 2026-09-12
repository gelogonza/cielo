import Image from "next/image";

import { type SourcePlatform } from "@/lib/items/platform";

export { toSourcePlatform, type SourcePlatform } from "@/lib/items/platform";

const glyphs: Partial<Record<SourcePlatform, string>> = {
  web: "a",
  x: "X",
  upload: "↑",
};

const labels: Record<SourcePlatform, string> = {
  web: "Saved from the web",
  instagram: "Saved from Instagram",
  tiktok: "Saved from TikTok",
  x: "Saved from X",
  upload: "Direct upload",
};

export function SourceBadge({ source }: { source: SourcePlatform }) {
  const glyph = glyphs[source];

  return (
    <span
      title={labels[source]}
      className="flex size-[26px] items-center justify-center rounded-full bg-black/55 backdrop-blur-[6px]"
    >
      <span className="sr-only">{labels[source]}</span>
      {glyph ? (
        <span aria-hidden className="text-[13px] leading-none font-semibold text-white">
          {glyph}
        </span>
      ) : (
        <Image
          aria-hidden
          src={`/icons/source-${source}.svg`}
          alt=""
          width={26}
          height={26}
          className="size-[26px]"
        />
      )}
    </span>
  );
}
