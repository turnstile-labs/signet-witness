import { neon } from "@neondatabase/serverless";

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
  updated_at: string;
}

export interface WitnessEvent {
  id: number;
  domain_id: number;
  receiver_domain: string;
  dkim_hash: string;
  witnessed_at: string;
}

// Upsert a domain on first CC, increment event count on subsequent ones.
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

// Record one witnessed email event.
export async function insertEvent(
  domainId: number,
  receiverDomain: string,
  dkimHash: string
): Promise<void> {
  await sql`
    INSERT INTO events (domain_id, receiver_domain, dkim_hash, witnessed_at)
    VALUES (${domainId}, ${receiverDomain}, ${dkimHash}, NOW())
  `;
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
  topSenders: Array<{ domain: string; event_count: number; first_seen: string }>;
  topReceivers: Array<{ receiver_domain: string; count: number }>;
  eventsByDay: Array<{ day: string; count: number }>;
  newDomainsByDay: Array<{ day: string; count: number }>;
  verifiedDomains: number;
  dbSize: string | null;
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

export async function getOpsStats(): Promise<OpsStats> {
  const [
    totals,
    windowed,
    denyTotal,
    denyByReason,
    topSenders,
    topReceivers,
    eventsByDay,
    newDomainsByDay,
    verified,
    dbSize,
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
    sql`
      SELECT domain, event_count, first_seen
      FROM domains
      ORDER BY event_count DESC, first_seen ASC
      LIMIT 15
    ` as unknown as Promise<
      { domain: string; event_count: number; first_seen: string }[]
    >,
    sql`
      SELECT receiver_domain, COUNT(*)::int AS count
      FROM events
      GROUP BY receiver_domain
      ORDER BY count DESC
      LIMIT 15
    ` as unknown as Promise<{ receiver_domain: string; count: number }[]>,
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
    sql`
      SELECT COUNT(*)::int AS n
      FROM domains d
      WHERE d.event_count >= 10
        AND d.first_seen <= NOW() - INTERVAL '90 days'
    ` as unknown as Promise<{ n: number }[]>,
    safe(
      sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      ` as unknown as Promise<{ size: string }[]>,
      [] as { size: string }[],
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
    topReceivers,
    eventsByDay,
    newDomainsByDay,
    verifiedDomains: verified[0]?.n ?? 0,
    dbSize: dbSize[0]?.size ?? null,
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
