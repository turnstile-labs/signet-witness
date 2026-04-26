// Surgical removal of one or more sender domains from the public
// ledger. Used to clear test artifacts and free-mail noise that
// shouldn't be part of the visible trust graph.
//
// What it does, per target domain:
//
//   1. DELETE FROM events_throttled WHERE sender_domain = $1
//      (no FK to domains — has to be deleted explicitly).
//
//   2. DELETE FROM domains WHERE domain = $1
//      Cascades to `events` and `domain_scores` via ON DELETE CASCADE
//      in the schema, so all sender-side history goes in one shot.
//
//   3. Receiver references in remaining events (e.g. real-domain →
//      target-domain) are LEFT IN PLACE. They become "unclaimed
//      receivers" on /ops, which is the right mental model: a real
//      domain *did* send a sealed email, the receiver just isn't a
//      registered sender anymore.
//
//   4. Recompute `domain_scores` for every remaining domain, since
//      mutual_counterparties and the diversity term can shift when
//      the receiver mix changes.
//
// Idempotent — re-running with a domain that was already purged is a
// no-op except for the recompute pass.
//
// Run it (dry-run preview):
//   DATABASE_URL=... npx tsx scripts/purge-domains.ts --dry-run gmail.com hotmail.com
// Run it for real:
//   DATABASE_URL=... npx tsx scripts/purge-domains.ts gmail.com hotmail.com

import { neon } from "@neondatabase/serverless";
import { refreshDomainMetrics } from "../lib/trust";

interface DomainRow {
  id: number;
  domain: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targets = args
    .filter((a) => !a.startsWith("--"))
    .map((d) => d.toLowerCase().trim())
    .filter(Boolean);

  if (targets.length === 0) {
    console.error(
      "Usage: tsx scripts/purge-domains.ts [--dry-run] <domain> [<domain> ...]",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (or STORAGE_URL) before running.");
    process.exit(1);
  }

  const sql = neon(url);

  console.log(
    `${dryRun ? "DRY RUN — " : ""}Purging ${targets.length} domain(s): ${targets.join(", ")}\n`,
  );

  // Pre-flight: count what would be removed so the operator can sanity
  // check before pulling the trigger.
  const matchingDomains = (await sql`
    SELECT id, domain FROM domains WHERE domain = ANY(${targets}::text[])
  `) as unknown as DomainRow[];

  const eventCounts =
    matchingDomains.length === 0
      ? []
      : ((await sql`
          SELECT domain_id, COUNT(*)::int AS n
          FROM events
          WHERE domain_id = ANY(${matchingDomains.map((d) => d.id)}::int[])
          GROUP BY domain_id
        `) as unknown as { domain_id: number; n: number }[]);

  const throttledCounts = (await sql`
    SELECT sender_domain, COUNT(*)::int AS n
    FROM events_throttled
    WHERE sender_domain = ANY(${targets}::text[])
    GROUP BY sender_domain
  `) as unknown as { sender_domain: string; n: number }[];

  const eventsByDomain = new Map(eventCounts.map((r) => [r.domain_id, r.n]));
  const throttledByDomain = new Map(
    throttledCounts.map((r) => [r.sender_domain, r.n]),
  );

  console.log("Plan:");
  for (const t of targets) {
    const row = matchingDomains.find((d) => d.domain === t);
    const events = row ? (eventsByDomain.get(row.id) ?? 0) : 0;
    const throttled = throttledByDomain.get(t) ?? 0;
    if (!row && throttled === 0) {
      console.log(`  · ${t.padEnd(36)} (no rows; skipping)`);
    } else {
      console.log(
        `  · ${t.padEnd(36)} domain=${row ? "yes" : "no"}  ` +
          `events=${events.toString().padStart(4)}  ` +
          `throttled=${throttled.toString().padStart(3)}`,
      );
    }
  }
  console.log("");

  if (dryRun) {
    console.log("Dry run — no rows deleted. Re-run without --dry-run to apply.");
    return;
  }

  // Step 1 — purge events_throttled (no FK).
  const throttledDeleted = (await sql`
    DELETE FROM events_throttled
    WHERE sender_domain = ANY(${targets}::text[])
    RETURNING id
  `) as unknown as { id: number }[];
  console.log(
    `Deleted ${throttledDeleted.length} row(s) from events_throttled.`,
  );

  // Step 2 — drop sender rows; cascades to events + domain_scores.
  const dropped = (await sql`
    DELETE FROM domains
    WHERE domain = ANY(${targets}::text[])
    RETURNING id, domain
  `) as unknown as DomainRow[];
  console.log(
    `Deleted ${dropped.length} row(s) from domains (cascaded events + domain_scores).`,
  );

  // Step 3 — recompute scores for everyone left.
  const remaining = (await sql`
    SELECT id, domain FROM domains ORDER BY id ASC
  `) as unknown as DomainRow[];

  if (remaining.length === 0) {
    console.log("\nNo remaining domains. Done.");
    return;
  }

  console.log(
    `\nRecomputing scores for ${remaining.length} remaining domain(s)...`,
  );

  let okCount = 0;
  let failCount = 0;
  for (const d of remaining) {
    const after = await refreshDomainMetrics(d.id, d.domain);
    if (!after) {
      failCount++;
      console.log(`  ✗ ${d.domain.padEnd(36)} FAILED`);
      continue;
    }
    okCount++;
    console.log(
      `  ✓ ${d.domain.padEnd(36)} ` +
        `idx=${after.trust_index.toString().padStart(3)}  ` +
        `verified=${after.verified_event_count.toString().padStart(4)}  ` +
        `mutuals=${after.mutual_counterparties.toString().padStart(2)}`,
    );
  }

  console.log(
    `\nDone. ${dropped.length} purged, ${okCount} rescored, ${failCount} failed.`,
  );
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
