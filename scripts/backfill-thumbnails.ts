import "dotenv/config";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scrape/scrape-url";

/**
 * Re-scrapes items that were saved before the thumbnail fallback chain existed
 * (see docs/devlog.md, 2026-09-12). Those rows have thumbnail_url NULL even
 * though the page usually offers *something* — a twitter:image, a touch icon.
 *
 * Safe to re-run: it only ever fills a NULL, never replaces a thumbnail that is
 * already there, and it re-checks that the row is still NULL at write time so a
 * concurrent save cannot be clobbered.
 *
 *   npm run backfill:thumbnails -- --dry-run
 *   npm run backfill:thumbnails -- --limit=50
 */

/** Pause between pages so a backfill does not hammer one host. */
const DELAY_MS = 500;

interface Options {
  dryRun: boolean;
  limit: number | undefined;
}

function parseOptions(argv: string[]): Options {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : undefined;

  return {
    dryRun: argv.includes("--dry-run"),
    limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { dryRun, limit } = parseOptions(process.argv.slice(2));

  const items = await prisma.item.findMany({
    // Direct uploads have no url, so there is nothing to re-scrape for them.
    where: { thumbnailUrl: null, url: { not: null } },
    select: { id: true, url: true, title: true },
    orderBy: { savedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  if (items.length === 0) {
    console.log("Nothing to backfill — no items with a missing thumbnail.");
    return;
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}Found ${items.length} item(s) with no thumbnail.\n`,
  );

  let filled = 0;
  let stillEmpty = 0;

  for (const [index, item] of items.entries()) {
    if (index > 0) {
      await sleep(DELAY_MS);
    }

    const scraped = await scrapeUrl(item.url!);
    const thumbnailUrl = scraped?.thumbnailUrl ?? null;
    // A missing title is worth repairing while we are here, but only if the
    // row has none — a user may have kept the original on purpose.
    const title = item.title ?? scraped?.title ?? null;

    if (!thumbnailUrl) {
      stillEmpty += 1;
      console.log(`  ·  no image found   ${item.url}`);
      continue;
    }

    filled += 1;
    console.log(`  ✓  ${dryRun ? "would fill" : "filled"}        ${item.url}`);
    console.log(`     → ${thumbnailUrl}`);

    if (!dryRun) {
      // The NULL guard means a save that landed since the query above wins.
      await prisma.item.updateMany({
        where: { id: item.id, thumbnailUrl: null },
        data: { thumbnailUrl, ...(item.title ? {} : { title }) },
      });
    }
  }

  console.log(
    `\n${dryRun ? "[dry run] " : ""}Done. ${filled} filled, ${stillEmpty} still without an image.`,
  );

  if (stillEmpty > 0) {
    console.log("Those pages publish no image at all; the feed shows a text card for them.");
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
