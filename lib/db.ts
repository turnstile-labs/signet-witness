import { neon } from "@neondatabase/serverless";
import { refreshDomainMetrics, SCORE_TTL_MS, FREE_MAIL_DOMAINS } from "./trust";

// Lazily initialised so `next build` doesn't require DATABASE_URL at compile time.
let _sql: ReturnType<typeof neon> | null = null;
function sql(...args: Parameters<ReturnType<typeof neon>>) {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
    if (!url) {
      throw new Error("DATABASE_URL or STORAGE_URL is not set");
    }
    _sql = neon(url);
  }
  return (_sql as ReturnType<typeof neon>)(...args);
}

export interface Domain {
  id: number;
  domain: string;
  first_seen: string;
  event_count: number;
  tier: string;
  grandfathered_verified: boolean;
  updated_at: string;
}

export interface WitnessEvent {
  id: number;
  domain_id: number;
  receiver_domain: string;
  dkim_hash: string;
  witnessed_at: string;
}

// Upsert a domain on first sealed email, increment event count on subsequent ones.
export async function upsertDomain(domain: string): Promise<Domain> {
  const rows = await sql`
    INSERT INTO domains (domain, first_seen, event_count, updated_at)
    VALUES (${domain}, NOW(), 1, NOW())
    ON CONFLICT (domain)
    DO UPDATE SET
      event_count = domains.event_count + 1,
      updated_at  = NOW()
    RETURNING *
  ` as unknown as Domain[];
  return rows[0];
}

// Record one witnessed email event. The domain_trust row for this
// sender is marked stale in the same round-trip so the next seal-page
// render recomputes the quality-adjusted view. Failure to mark stale
// is non-fatal — the trust index will still refresh at TTL.
export async function insertEvent(
  domainId: number,
  receiverDomain: string,
  dkimHash: string
): Promise<void> {
  await sql`
    INSERT INTO events (domain_id, receiver_domain, dkim_hash, witnessed_at)
    VALUES (${domainId}, ${receiverDomain}, ${dkimHash}, NOW())
  `;
  try {
    await sql`
      INSERT INTO domain_trust (domain_id, stale, computed_at)
      VALUES (${domainId}, TRUE, NOW())
      ON CONFLICT (domain_id) DO UPDATE SET stale = TRUE
    `;
  } catch (err) {
    console.error("[db] insertEvent mark-stale failed", { domainId, err });
  }
}

// Fetch a domain record by name. Returns null if not found.
export async function getDomain(domain: string): Promise<Domain | null> {
  try {
    const rows = await sql`
      SELECT * FROM domains WHERE domain = ${domain}
    ` as unknown as Domain[];
    return rows[0] ?? null;
  } catch (err) {
    console.error("[db] getDomain failed", { domain, err });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// GDPR INVARIANT — public surface returns aggregates only.
//
// Receiver-domain identities are personal data (sole traders,
// one-person LLCs, name-based domains). They are never exposed
// in any public render path (the /b/[domain] seal page). They
// are only readable via the authenticated Art 15 export at
// /api/rights/access, which requires DNS TXT ownership proof.
//
// This is enforced at the function boundary: there is no public
// helper that returns a list of `receiver_domain` values. Any
// future work that touches this invariant must go through DPA
// review, not code review. Do not add a `getEvents`-style helper
// back without that review.
// ─────────────────────────────────────────────────────────────

export interface SealAggregates {
  uniqueReceivers: number;
}

// Aggregate-only view for the public seal page. Returns counts,
// never identities. See GDPR INVARIANT above.
export async function getSealAggregates(
  domainId: number
): Promise<SealAggregates> {
  try {
    const rows = (await sql`
      SELECT COUNT(DISTINCT receiver_domain)::int AS unique_receivers
      FROM events
      WHERE domain_id = ${domainId}
    `) as unknown as { unique_receivers: number }[];
    return { uniqueReceivers: rows[0]?.unique_receivers ?? 0 };
  } catch (err) {
    console.error("[db] getSealAggregates failed", { domainId, err });
    return { uniqueReceivers: 0 };
  }
}

// Count how many witnessed emails list this domain as a receiver
// (for the "unclaimed" state on the seal page).
export async function getReceiverCount(domain: string): Promise<number> {
  try {
    const rows = await sql`
      SELECT COUNT(*) AS count FROM events WHERE receiver_domain = ${domain}
    ` as unknown as { count: string }[];
    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    console.error("[db] getReceiverCount failed", { domain, err });
    return 0;
  }
}

// Daily event counts over the last N days — used for the sparkline
// on the seal page. Returns buckets in chronological order.
export async function getDailyActivity(
  domainId: number,
  days: number = 30
): Promise<{ date: string; count: number }[]> {
  try {
    const rows = await sql`
      SELECT
        to_char(date_trunc('day', witnessed_at), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM events
      WHERE domain_id = ${domainId}
        AND witnessed_at >= NOW() - INTERVAL '1 day' * ${days}
      GROUP BY 1
      ORDER BY 1 ASC
    ` as unknown as { date: string; count: number }[];
    return rows;
  } catch (err) {
    console.error("[db] getDailyActivity failed", { domainId, days, err });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// GDPR helpers — denylist, erasure, subject access
// ─────────────────────────────────────────────────────────────

export type DenylistReason = "erasure" | "opt_out";

// True if the domain has been opted out or erased. Failure-mode matters:
// the inbound path calls this best-effort. If the check errors, we log
// and return false (fail-open) so a transient DB hiccup doesn't block
// legitimate email writes. Rights endpoints re-check at write time.
export async function isDenylisted(domain: string): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT 1 FROM domain_denylist WHERE domain = ${domain} LIMIT 1
    ` as unknown as unknown[];
    return rows.length > 0;
  } catch (err) {
    console.error("[db] isDenylisted failed", { domain, err });
    return false;
  }
}

export async function addToDenylist(
  domain: string,
  reason: DenylistReason
): Promise<void> {
  await sql`
    INSERT INTO domain_denylist (domain, reason)
    VALUES (${domain}, ${reason})
    ON CONFLICT (domain) DO UPDATE SET reason = EXCLUDED.reason
  `;
}

export interface EraseResult {
  domainPurged: boolean;
  eventsAsSender: number;
  eventsAsReceiver: number;
}

// Hard-delete every record referencing this domain (Art 17 erasure).
// 1. Delete the domains row → cascades to events where it was sender.
// 2. Delete events where it appears as receiver across all senders.
// 3. Decrement event_count on affected senders.
export async function eraseDomain(domain: string): Promise<EraseResult> {
  let domainPurged = false;
  let eventsAsSender = 0;
  let eventsAsReceiver = 0;

  const senderRows = await sql`
    WITH purged AS (
      DELETE FROM domains WHERE domain = ${domain}
      RETURNING id, event_count
    )
    SELECT
      COUNT(*)::int AS rows_deleted,
      COALESCE(SUM(event_count), 0)::int AS events_deleted
    FROM purged
  ` as unknown as { rows_deleted: number; events_deleted: number }[];
  domainPurged = (senderRows[0]?.rows_deleted ?? 0) > 0;
  eventsAsSender = senderRows[0]?.events_deleted ?? 0;

  const recvRows = await sql`
    WITH purged AS (
      DELETE FROM events WHERE receiver_domain = ${domain}
      RETURNING domain_id
    ),
    counts AS (
      SELECT domain_id, COUNT(*)::int AS n FROM purged GROUP BY domain_id
    ),
    updated AS (
      UPDATE domains d
      SET event_count = GREATEST(0, d.event_count - c.n),
          updated_at  = NOW()
      FROM counts c
      WHERE d.id = c.domain_id
      RETURNING 1
    )
    SELECT COUNT(*)::int AS total FROM purged
  ` as unknown as { total: number }[];
  eventsAsReceiver = recvRows[0]?.total ?? 0;

  return { domainPurged, eventsAsSender, eventsAsReceiver };
}

// ─────────────────────────────────────────────────────────────
// Ops stats — for the internal /ops/<token> dashboard
// ─────────────────────────────────────────────────────────────

export interface OpsStats {
  domains: number;
  events: number;
  distinctReceivers: number;
  unclaimedReceivers: number;
  events24h: number;
  events7d: number;
  events30d: number;
  newDomains7d: number;
  newDomains30d: number;
  denylistTotal: number;
  denylistByReason: Array<{ reason: string; count: number }>;
  topSenders: Array<{
    domain: string;
    event_count: number;
    first_seen: string;
    trust_index: number | null;
    mutual_counterparties: number | null;
    counterparty_count: number | null;
    verified_event_count: number | null;
    grandfathered_verified: boolean;
  }>;
  eventsByDay: Array<{ day: string; count: number }>;
  newDomainsByDay: Array<{ day: string; count: number }>;
  verifiedDomains: number;
  dbSize: string | null;
  // Canonical-state split across every registered sender. Sums to
  // `domains`; used on ops to show the shape of the population, not
  // just the leaderboard head.
  senderTiers: { verified: number; building: number; inactive: number };
  // Mutual edges — sender A sealed to sender B AND vice-versa. These
  // are the strongest trust signal in the graph and the only network
  // shape an attacker can't cheaply fake (requires both sides to be
  // DKIM-signing, domain-owning senders who also seal their own outbound).
  mutualPairsTotal: number;
  mutualPairs: Array<{ a: string; b: string; events: number }>;
  // Anti-abuse visibility (Layer 0). Counts of events we refused to
  // surface publicly, broken down by reason and by top offender.
  throttled24h: number;
  throttled7d: number;
  throttledByReason: Array<{ reason: string; count: number }>;
  throttledTopSenders: Array<{ sender_domain: string; count: number }>;
  // Top receiver domains by inbound seal volume. Complements the
  // sender-side leaderboard so the dashboard surfaces both halves of
  // every edge — without it, a busy receiver who isn't a registered
  // sender (the unclaimed side of the invite loop) is invisible
  // beyond a single aggregate count. `registered` is TRUE iff the
  // receiver is itself in the `domains` table — i.e. a mutual is
  // possible from this side.
  topReceivers: Array<{
    domain: string;
    events: number;
    distinct_senders: number;
    last_seen: string;
    registered: boolean;
  }>;
}

// Swallow "relation does not exist" (42P01) so the ops page keeps
// working even when optional tables (e.g. domain_denylist) haven't
// been migrated yet. Any other error propagates.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (code === "42P01" || /does not exist/i.test(msg)) {
      return fallback;
    }
    throw err;
  }
}

// Count of verified domains under the Layer-2 rule (composite trust
// index + mutuality floor), OR grandfathered from the pre-Layer-2
// rule. Falls back to the legacy count when the new tables/column
// haven't been migrated yet.
async function verifiedCount(): Promise<{ n: number }[]> {
  try {
    return (await sql`
      SELECT COUNT(DISTINCT d.id)::int AS n
      FROM domains d
      LEFT JOIN domain_trust s ON s.domain_id = d.id
      WHERE d.grandfathered_verified = TRUE
         OR (s.trust_index >= 65 AND s.mutual_counterparties >= 3)
    `) as unknown as { n: number }[];
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (!(code === "42P01" || /does not exist/i.test(msg))) throw err;
    return (await sql`
      SELECT COUNT(*)::int AS n
      FROM domains d
      WHERE d.event_count >= 10
        AND d.first_seen <= NOW() - INTERVAL '90 days'
    `) as unknown as { n: number }[];
  }
}

// Top senders, ranked by trust_index first and event_count as a
// tie-breaker. Falls back to a bare query when domain_trust hasn't
// been migrated in yet — keeps the ops page working on first deploy
// before the schema update is run.
type OpsSenderRow = {
  domain: string;
  event_count: number;
  first_seen: string;
  trust_index: number | null;
  mutual_counterparties: number | null;
  counterparty_count: number | null;
  verified_event_count: number | null;
  grandfathered_verified: boolean;
};

// Query carries `domain_id`, `stale`, and `computed_at` so the caller
// can refresh anything past the TTL or explicitly flagged stale before
// the page reads it. Stripped from the public OpsSenderRow on return.
type OpsSenderRowInternal = OpsSenderRow & {
  domain_id: number;
  stale: boolean;
  computed_at: string | null;
};

async function topSendersWithMetrics(): Promise<OpsSenderRow[]> {
  let rows: OpsSenderRowInternal[];
  try {
    rows = (await sql`
      SELECT d.id                     AS domain_id,
             d.domain, d.event_count, d.first_seen,
             d.grandfathered_verified,
             s.trust_index           AS trust_index,
             s.mutual_counterparties AS mutual_counterparties,
             s.counterparty_count    AS counterparty_count,
             s.verified_event_count  AS verified_event_count,
             COALESCE(s.stale, TRUE) AS stale,
             s.computed_at           AS computed_at
      FROM domains d
      LEFT JOIN domain_trust s ON s.domain_id = d.id
      ORDER BY
        COALESCE(s.trust_index, 0) DESC,
        d.event_count DESC,
        d.first_seen ASC
      LIMIT 15
    `) as unknown as OpsSenderRowInternal[];
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (!(code === "42P01" || /does not exist/i.test(msg))) throw err;
    rows = (await sql`
      SELECT id                     AS domain_id,
             domain, event_count, first_seen,
             COALESCE(grandfathered_verified, FALSE) AS grandfathered_verified,
             NULL::int       AS trust_index,
             NULL::int       AS mutual_counterparties,
             NULL::int       AS counterparty_count,
             NULL::int       AS verified_event_count,
             TRUE            AS stale,
             NULL::timestamptz AS computed_at
      FROM domains
      ORDER BY event_count DESC, first_seen ASC
      LIMIT 15
    `) as unknown as OpsSenderRowInternal[];
  }

  // Opportunistic refresh: any row whose domain_trust is missing,
  // explicitly stale, or older than SCORE_TTL_MS gets recomputed before
  // the page reads it. Without this the leaderboard can show counts
  // captured *before* the most recent insertEvent (which only flips
  // the stale bit; refresh runs on next read). /ops doesn't go through
  // getDomainMetrics per row, so it has to do the refresh itself.
  //
  // Bounded by LIMIT 15 above — at most 15 refreshes, each ~2 round-trips.
  // Failures fall back to the cached numbers; we don't block the dashboard
  // on a recompute hiccup.
  const now = Date.now();
  const needsRefresh = rows.filter((r) => {
    if (r.stale) return true;
    if (!r.computed_at) return true;
    const age = now - Date.parse(r.computed_at);
    return Number.isFinite(age) && age >= SCORE_TTL_MS;
  });
  if (needsRefresh.length > 0) {
    const refreshed = await Promise.all(
      needsRefresh.map((r) =>
        refreshDomainMetrics(r.domain_id, r.domain).catch((err) => {
          console.error("[db] opportunistic refresh failed", {
            domain: r.domain,
            err,
          });
          return null;
        }),
      ),
    );
    refreshed.forEach((m, i) => {
      if (!m) return;
      const row = needsRefresh[i];
      row.trust_index = m.trust_index;
      row.mutual_counterparties = m.mutual_counterparties;
      row.counterparty_count = m.counterparty_count;
      row.verified_event_count = m.verified_event_count;
    });
  }

  return rows.map((r) => ({
    domain: r.domain,
    event_count: r.event_count,
    first_seen: r.first_seen,
    grandfathered_verified: r.grandfathered_verified,
    trust_index: r.trust_index,
    mutual_counterparties: r.mutual_counterparties,
    counterparty_count: r.counterparty_count,
    verified_event_count: r.verified_event_count,
  }));
}

// Top receiver domains by inbound seal volume. Mirrors topSendersWithMetrics
// but on the other side of the edge: who's *receiving* seals from registered
// senders. Surfacing this on /ops fills the gap that prompted the
// "we don't see receivers" feedback — until now, the only receiver-side
// signals were the two aggregate stats (Distinct recipients, Unclaimed)
// and the Mutual edges table (which only shows reciprocal pairs).
//
// `registered` flags whether the receiver is itself in the `domains` table.
// A registered receiver is one mutual edge away (if they ever seal back);
// an unregistered receiver is an invite-loop opportunity.
//
// Free-mail receivers (gmail.com, outlook.com, …) are filtered out
// post-query: they can NEVER become Registered (the inbound webhook
// rejects them as senders at intake), so their permanent "Unclaimed"
// status is structurally meaningless on this leaderboard. They also
// dominate raw volume in any non-trivial inbox (employees, customers,
// support replies), pushing the actually-actionable business
// counterparties off the visible top-N. Keeping the boundary identical
// to FREE_MAIL_DOMAINS in lib/trust.ts mirrors what intake and the
// extension popup already do — the panel's signal/noise improves
// without adding a new convention.
//
// We over-fetch (32 rows) and slice to 8 after filtering, so even an
// inbox where all of the top ~20 receivers are consumer-mail still
// surfaces 8 real business rows. 32 was chosen as a small constant
// well above the size of the free-mail set (~21).
async function topReceiversList(): Promise<
  Array<{
    domain: string;
    events: number;
    distinct_senders: number;
    last_seen: string;
    registered: boolean;
  }>
> {
  const rows = (await sql`
    SELECT
      e.receiver_domain                     AS domain,
      COUNT(*)::int                         AS events,
      COUNT(DISTINCT e.domain_id)::int      AS distinct_senders,
      MAX(e.witnessed_at)                   AS last_seen,
      EXISTS (
        SELECT 1 FROM domains d2 WHERE d2.domain = e.receiver_domain
      )                                     AS registered
    FROM events e
    GROUP BY e.receiver_domain
    ORDER BY events DESC, last_seen DESC
    LIMIT 32
  `) as unknown as Array<{
    domain: string;
    events: number;
    distinct_senders: number;
    last_seen: string;
    registered: boolean;
  }>;
  return rows.filter((r) => !FREE_MAIL_DOMAINS.has(r.domain)).slice(0, 8);
}

// Population shape across every registered sender: how many are
// Verified / Building / Inactive. Same predicates as lib/trust.ts
// (trustTierFromMetrics) — duplicated in SQL for a one-shot count.
//
// "building" matches the public TrustTier exactly. "inactive" is an
// operator-only sub-bucket of "building" (zero rows in `events` vs
// ≥1). Public surfaces never see "inactive"; they show "building"
// for both. The state is reachable two ways:
//
//   1. Receiver-side GDPR erasure cascade. When a receiver invokes
//      Art 17, every event with that domain is deleted from `events`.
//      Any sender whose only counterparty was that receiver keeps
//      their `domains` row but loses every event — verified_event_count
//      drops to 0 → "inactive".
//   2. Vanishingly rare write race between upsertDomain and
//      insertEvent (separate statements; the worker retries, but the
//      domain row exists during the retry window).
//
// Surfacing it lets an operator see "this domain has a row but no
// events" at a glance — the typical cause is the erasure cascade, and
// having a labeled bucket makes that obvious without forensic SQL.
async function senderTierCounts(): Promise<{
  verified: number;
  building: number;
  inactive: number;
}> {
  try {
    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE d.grandfathered_verified
             OR (s.trust_index >= 65 AND s.mutual_counterparties >= 3)
        )::int AS verified,
        COUNT(*) FILTER (
          WHERE NOT (
            d.grandfathered_verified
            OR (s.trust_index >= 65 AND s.mutual_counterparties >= 3)
          ) AND COALESCE(s.verified_event_count, 0) > 0
        )::int AS building,
        COUNT(*) FILTER (
          WHERE NOT (
            d.grandfathered_verified
            OR (s.trust_index >= 65 AND s.mutual_counterparties >= 3)
          ) AND COALESCE(s.verified_event_count, 0) = 0
        )::int AS inactive
      FROM domains d
      LEFT JOIN domain_trust s ON s.domain_id = d.id
    `) as unknown as Array<{
      verified: number;
      building: number;
      inactive: number;
    }>;
    return {
      verified: rows[0]?.verified ?? 0,
      building: rows[0]?.building ?? 0,
      inactive: rows[0]?.inactive ?? 0,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (!(code === "42P01" || /does not exist/i.test(msg))) throw err;
    return { verified: 0, building: 0, inactive: 0 };
  }
}

// Mutual edges — top 5 by combined volume, plus total count. A mutual
// pair exists iff domain A has sealed to domain B AND domain B (also
// registered as a sender) has sealed back to A. Both sides of the
// edge are already in `domains`, so surfacing them on /ops doesn't
// disclose a receiver identity we'd normally keep private.
async function mutualPairsSnapshot(): Promise<{
  total: number;
  top: Array<{ a: string; b: string; events: number }>;
}> {
  try {
    const rows = (await sql`
      WITH edges AS (
        SELECT d.domain AS a, e.receiver_domain AS b, COUNT(*)::int AS n
        FROM events e
        JOIN domains d ON d.id = e.domain_id
        GROUP BY 1, 2
      ),
      pairs AS (
        SELECT e1.a AS a, e1.b AS b, (e1.n + e2.n)::int AS events
        FROM edges e1
        JOIN edges e2 ON e1.a = e2.b AND e1.b = e2.a
        WHERE e1.a < e1.b
      )
      SELECT a, b, events,
             COUNT(*) OVER ()::int AS total
      FROM pairs
      ORDER BY events DESC
      LIMIT 5
    `) as unknown as Array<{
      a: string;
      b: string;
      events: number;
      total: number;
    }>;
    return {
      total: rows[0]?.total ?? 0,
      top: rows.map((r) => ({ a: r.a, b: r.b, events: r.events })),
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message ?? "";
    if (!(code === "42P01" || /does not exist/i.test(msg))) throw err;
    return { total: 0, top: [] };
  }
}

export async function getOpsStats(): Promise<OpsStats> {
  const [
    totals,
    windowed,
    denyTotal,
    denyByReason,
    topSenders,
    eventsByDay,
    newDomainsByDay,
    verified,
    dbSize,
    senderTiers,
    mutualPairs,
    topReceivers,
  ] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM domains)                                     AS domains,
        (SELECT COUNT(*)::int FROM events)                                      AS events,
        (SELECT COUNT(DISTINCT receiver_domain)::int FROM events)               AS distinct_receivers,
        (SELECT COUNT(*)::int FROM (
           SELECT DISTINCT receiver_domain FROM events
           EXCEPT
           SELECT domain FROM domains
         ) u)                                                                   AS unclaimed_receivers
    ` as unknown as Promise<
      {
        domains: number;
        events: number;
        distinct_receivers: number;
        unclaimed_receivers: number;
      }[]
    >,
    sql`
      SELECT
        COALESCE(SUM(CASE WHEN witnessed_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0)::int AS d1,
        COALESCE(SUM(CASE WHEN witnessed_at >= NOW() - INTERVAL '7 days'   THEN 1 ELSE 0 END), 0)::int AS d7,
        COALESCE(SUM(CASE WHEN witnessed_at >= NOW() - INTERVAL '30 days'  THEN 1 ELSE 0 END), 0)::int AS d30,
        (SELECT COUNT(*)::int FROM domains WHERE first_seen >= NOW() - INTERVAL '7 days')   AS nd7,
        (SELECT COUNT(*)::int FROM domains WHERE first_seen >= NOW() - INTERVAL '30 days')  AS nd30
      FROM events
    ` as unknown as Promise<
      { d1: number; d7: number; d30: number; nd7: number; nd30: number }[]
    >,
    safe(
      sql`SELECT COUNT(*)::int AS n FROM domain_denylist` as unknown as Promise<
        { n: number }[]
      >,
      [{ n: 0 }] as { n: number }[],
    ),
    safe(
      sql`
        SELECT reason, COUNT(*)::int AS count
        FROM domain_denylist
        GROUP BY reason
        ORDER BY count DESC
      ` as unknown as Promise<{ reason: string; count: number }[]>,
      [] as { reason: string; count: number }[],
    ),
    topSendersWithMetrics(),
    sql`
      SELECT to_char(date_trunc('day', witnessed_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM events
      WHERE witnessed_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1 ASC
    ` as unknown as Promise<{ day: string; count: number }[]>,
    sql`
      SELECT to_char(date_trunc('day', first_seen), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM domains
      WHERE first_seen >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1 ASC
    ` as unknown as Promise<{ day: string; count: number }[]>,
    verifiedCount(),
    safe(
      sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      ` as unknown as Promise<{ size: string }[]>,
      [] as { size: string }[],
    ),
    senderTierCounts(),
    mutualPairsSnapshot(),
    safe(
      topReceiversList(),
      [] as Array<{
        domain: string;
        events: number;
        distinct_senders: number;
        last_seen: string;
        registered: boolean;
      }>,
    ),
  ]);

  // Anti-abuse visibility — fetched separately so the legacy totals
  // block above stays a single cacheable query shape. `safe` swallows
  // "relation does not exist" until the migrations are run in prod.
  const [
    throttledWindowed,
    throttledByReason,
    throttledTopSenders,
  ] = await Promise.all([
      safe(
        sql`
          SELECT
            COALESCE(SUM(CASE WHEN witnessed_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0)::int AS d1,
            COALESCE(SUM(CASE WHEN witnessed_at >= NOW() - INTERVAL '7 days'   THEN 1 ELSE 0 END), 0)::int AS d7
          FROM events_throttled
        ` as unknown as Promise<{ d1: number; d7: number }[]>,
        [{ d1: 0, d7: 0 }] as { d1: number; d7: number }[],
      ),
      safe(
        sql`
          SELECT reason, COUNT(*)::int AS count
          FROM events_throttled
          WHERE witnessed_at >= NOW() - INTERVAL '7 days'
          GROUP BY reason
          ORDER BY count DESC
        ` as unknown as Promise<{ reason: string; count: number }[]>,
        [] as { reason: string; count: number }[],
      ),
      safe(
        sql`
          SELECT sender_domain, COUNT(*)::int AS count
          FROM events_throttled
          WHERE witnessed_at >= NOW() - INTERVAL '7 days'
          GROUP BY sender_domain
          ORDER BY count DESC
          LIMIT 8
        ` as unknown as Promise<{ sender_domain: string; count: number }[]>,
        [] as { sender_domain: string; count: number }[],
      ),
    ]);

  const t = totals[0] ?? {
    domains: 0,
    events: 0,
    distinct_receivers: 0,
    unclaimed_receivers: 0,
  };
  const w = windowed[0] ?? { d1: 0, d7: 0, d30: 0, nd7: 0, nd30: 0 };

  return {
    domains: t.domains,
    events: t.events,
    distinctReceivers: t.distinct_receivers,
    unclaimedReceivers: t.unclaimed_receivers,
    events24h: w.d1,
    events7d: w.d7,
    events30d: w.d30,
    newDomains7d: w.nd7,
    newDomains30d: w.nd30,
    denylistTotal: denyTotal[0]?.n ?? 0,
    denylistByReason: denyByReason,
    topSenders,
    eventsByDay,
    newDomainsByDay,
    verifiedDomains: verified[0]?.n ?? 0,
    dbSize: dbSize[0]?.size ?? null,
    senderTiers,
    mutualPairsTotal: mutualPairs.total,
    mutualPairs: mutualPairs.top,
    throttled24h: throttledWindowed[0]?.d1 ?? 0,
    throttled7d: throttledWindowed[0]?.d7 ?? 0,
    throttledByReason,
    throttledTopSenders,
    topReceivers,
  };
}

export interface DomainExport {
  domain: Domain | null;
  events: WitnessEvent[];
  receivedMentions: Array<{
    sender_domain: string;
    witnessed_at: string;
    dkim_hash: string;
  }>;
  denylist: { reason: string; created_at: string } | null;
  exportedAt: string;
}

// Full machine-readable dump of everything held about a domain (Art 15).
export async function exportDomainData(domain: string): Promise<DomainExport> {
  const domRows = await sql`
    SELECT * FROM domains WHERE domain = ${domain}
  ` as unknown as Domain[];
  const domRow = domRows[0] ?? null;

  let events: WitnessEvent[] = [];
  if (domRow) {
    events = (await sql`
      SELECT * FROM events
      WHERE domain_id = ${domRow.id}
      ORDER BY witnessed_at DESC
    `) as unknown as WitnessEvent[];
  }

  const receivedMentions = (await sql`
    SELECT d.domain AS sender_domain, e.witnessed_at, e.dkim_hash
    FROM events e
    JOIN domains d ON d.id = e.domain_id
    WHERE e.receiver_domain = ${domain}
    ORDER BY e.witnessed_at DESC
  `) as unknown as {
    sender_domain: string;
    witnessed_at: string;
    dkim_hash: string;
  }[];

  const denyRows = (await sql`
    SELECT reason, created_at FROM domain_denylist WHERE domain = ${domain}
  `) as unknown as { reason: string; created_at: string }[];

  return {
    domain: domRow,
    events,
    receivedMentions,
    denylist: denyRows[0] ?? null,
    exportedAt: new Date().toISOString(),
  };
}
