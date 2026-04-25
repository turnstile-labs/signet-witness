// One-shot recompute of every `domain_scores` row.
//
// Why this exists:
//   `insertEvent` writes to `events` and marks `domain_scores.stale = TRUE`
//   in the same round-trip, but it does NOT recompute `verified_event_count`
//   or any other derived signal — that's lazy, triggered by the next
//   read on the seal page. Two failure modes leave `/ops` showing
//   "Inactive" (the operator-only sub-bucket of Building) for domains
//   that have real events:
//
//     1. The `domain_scores` row never got created at all — most often
//        because the domain was first seen before the schema migration
//        ran. The LEFT JOIN on /ops returns NULL → COALESCE to 0 →
//        Inactive.
//
//     2. The recompute hasn't been triggered yet — no one has visited
//        `/b/<domain>` since the last event landed.
//
// This script walks every row in `domains`, calls `refreshDomainScore`
// on each (which is the same path the seal page uses), and prints a
// before/after diff per domain. Idempotent — safe to re-run any time
// scoring logic changes or a backfill is needed.
//
// Run it:
//   DATABASE_URL=... npx tsx scripts/backfill-scores.ts
// or, if .env.local has DATABASE_URL set:
//   npm run backfill:scores

import { neon } from "@neondatabase/serverless";
import { refreshDomainScore } from "../lib/scores";

interface DomainRow {
  id: number;
  domain: string;
}

interface ScoreSnapshot {
  verified_event_count: number;
  mutual_counterparties: number;
  trust_index: number;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (or STORAGE_URL) before running.");
    console.error("  e.g. add it to .env.local and run `npm run backfill:scores`.");
    process.exit(1);
  }

  const sql = neon(url);

  const domains = (await sql`
    SELECT id, domain
    FROM domains
    ORDER BY id ASC
  `) as unknown as DomainRow[];

  if (domains.length === 0) {
    console.log("No domains in the database. Nothing to do.");
    return;
  }

  console.log(`Backfilling scores for ${domains.length} domain(s)...\n`);

  let okCount = 0;
  let failCount = 0;
  let createdCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  // Sequential rather than Promise.all — refreshDomainScore makes ~3
  // DB round-trips per domain, and we'd rather not stampede the pool
  // on a one-shot maintenance script. Volume is tiny anyway.
  for (let i = 0; i < domains.length; i++) {
    const d = domains[i];
    const idx = `[${(i + 1).toString().padStart(3)}/${domains.length}]`;

    const beforeRows = (await sql`
      SELECT verified_event_count, mutual_counterparties, trust_index
      FROM domain_scores
      WHERE domain_id = ${d.id}
      LIMIT 1
    `) as unknown as ScoreSnapshot[];
    const before = beforeRows[0] ?? null;

    const after = await refreshDomainScore(d.id, d.domain);

    if (!after) {
      failCount++;
      console.log(`${idx} ✗  ${d.domain.padEnd(40)} FAILED`);
      continue;
    }

    okCount++;

    let tag: string;
    if (!before) {
      createdCount++;
      tag = "CREATED";
    } else if (
      before.verified_event_count !== after.verified_event_count ||
      before.mutual_counterparties !== after.mutual_counterparties ||
      before.trust_index !== after.trust_index
    ) {
      changedCount++;
      tag = `CHANGED  (idx ${before.trust_index} → ${after.trust_index})`;
    } else {
      unchangedCount++;
      tag = "ok";
    }

    console.log(
      `${idx} ✓  ${d.domain.padEnd(40)} ` +
      `idx=${after.trust_index.toString().padStart(3)}  ` +
      `verified=${after.verified_event_count.toString().padStart(4)}  ` +
      `mutuals=${after.mutual_counterparties.toString().padStart(2)}  ` +
      `${tag}`,
    );
  }

  console.log(
    `\nDone. ${okCount} ok (${createdCount} created, ${changedCount} changed, ${unchangedCount} unchanged), ${failCount} failed.`,
  );
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
