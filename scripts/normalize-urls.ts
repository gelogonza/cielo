import "dotenv/config";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/url/normalize-url";

/**
 * Rewrites item urls saved before `normalizeUrl` existed (see docs/devlog.md,
 * 2026-09-19). Saves used to store whatever string they were handed while
 * imports normalized theirs, so `https://x.com` and `https://x.com/` could be
 * two rows for one page — and re-importing your own export duplicated them.
 *
 * Where normalizing collides with a row that already holds the normal form,
 * the two are merged rather than one being dropped: the older row survives,
 * and the newer row's sections, tags and note move onto it first.
 *
 * Safe to re-run — `normalizeUrl` is idempotent, so a second pass finds
 * nothing. Always dry-run first.
 *
 *   npm run backfill:urls -- --dry-run
 *   npm run backfill:urls
 */

interface Options {
  dryRun: boolean;
}

function parseOptions(argv: string[]): Options {
  return { dryRun: argv.includes("--dry-run") };
}

/**
 * Moves everything hanging off `loserId` onto `winnerId`, then deletes the
 * loser. `skipDuplicates` covers the case where both rows are already in the
 * same section or carry the same tag.
 */
async function merge(winnerId: string, loserId: string) {
  await prisma.$transaction(async (tx) => {
    const [sections, tags, note, winnerNote] = await Promise.all([
      tx.itemSection.findMany({ where: { itemId: loserId } }),
      tx.itemTag.findMany({ where: { itemId: loserId } }),
      tx.note.findUnique({ where: { itemId: loserId } }),
      tx.note.findUnique({ where: { itemId: winnerId } }),
    ]);

    if (sections.length > 0) {
      await tx.itemSection.createMany({
        data: sections.map(({ sectionId }) => ({ itemId: winnerId, sectionId })),
        skipDuplicates: true,
      });
    }

    if (tags.length > 0) {
      await tx.itemTag.createMany({
        data: tags.map(({ tagId }) => ({ itemId: winnerId, tagId })),
        skipDuplicates: true,
      });
    }

    // Notes are 1:1. Keeping both means joining them — losing something the
    // user typed is the one outcome this script must never produce.
    if (note) {
      if (winnerNote) {
        await tx.note.update({
          where: { itemId: winnerId },
          data: { body: `${winnerNote.body}\n\n${note.body}` },
        });
      } else {
        await tx.note.create({ data: { itemId: winnerId, body: note.body } });
      }
    }

    await tx.item.delete({ where: { id: loserId } });
  });
}

async function main() {
  const { dryRun } = parseOptions(process.argv.slice(2));

  const items = await prisma.item.findMany({
    where: { url: { not: null } },
    select: { id: true, userId: true, url: true, savedAt: true },
    // Oldest first, so the row a merge keeps is the one saved first.
    orderBy: { savedAt: "asc" },
  });

  // [user id, normalized url] → the id of the first row that claimed it.
  const claimed = new Map<string, string>();
  let rewritten = 0;
  let merged = 0;
  let unchanged = 0;
  let unusable = 0;

  for (const item of items) {
    const normalized = normalizeUrl(item.url);

    if (!normalized) {
      unusable += 1;
      console.log(`  !  not a usable address, left alone   ${item.url}`);
      continue;
    }

    const key = JSON.stringify([item.userId, normalized]);
    const winner = claimed.get(key);

    if (winner) {
      merged += 1;
      console.log(
        `  =  ${dryRun ? "would merge" : "merged"} into the earlier copy   ${normalized}`,
      );

      if (!dryRun) {
        await merge(winner, item.id);
      }

      continue;
    }

    claimed.set(key, item.id);

    if (normalized === item.url) {
      unchanged += 1;
      continue;
    }

    rewritten += 1;
    console.log(`  >  ${dryRun ? "would rewrite" : "rewrote"}   ${item.url}`);
    console.log(`     -> ${normalized}`);

    if (!dryRun) {
      await prisma.item.update({ where: { id: item.id }, data: { url: normalized } });
    }
  }

  console.log(
    `\n${dryRun ? "[dry run] " : ""}Done. ${rewritten} rewritten, ${merged} merged, ` +
      `${unchanged} already in normal form` +
      (unusable > 0 ? `, ${unusable} left alone` : "") +
      ".",
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
