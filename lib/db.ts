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

// Fetch recent events for a domain (latest 50).
export async function getEvents(domainId: number): Promise<WitnessEvent[]> {
  try {
    const rows = await sql`
      SELECT * FROM events
      WHERE domain_id = ${domainId}
      ORDER BY witnessed_at DESC
      LIMIT 50
    ` as unknown as WitnessEvent[];
    return rows;
  } catch (err) {
    console.error("[db] getEvents failed", { domainId, err });
    return [];
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
