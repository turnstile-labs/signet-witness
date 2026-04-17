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
  const rows = await sql`
    SELECT * FROM domains WHERE domain = ${domain}
  ` as unknown as Domain[];
  return rows[0] ?? null;
}

// Fetch recent events for a domain (latest 50).
export async function getEvents(domainId: number): Promise<WitnessEvent[]> {
  const rows = await sql`
    SELECT * FROM events
    WHERE domain_id = ${domainId}
    ORDER BY witnessed_at DESC
    LIMIT 50
  ` as unknown as WitnessEvent[];
  return rows;
}

// Count how many witnessed emails list this domain as a receiver
// (for the "unclaimed" state on the seal page).
export async function getReceiverCount(domain: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) AS count FROM events WHERE receiver_domain = ${domain}
  ` as unknown as { count: string }[];
  return Number(rows[0]?.count ?? 0);
}

// Network-wide stats for the landing page live counter.
// Returns null if the DB is unreachable (e.g. local dev without DATABASE_URL)
// so the UI can gracefully hide the counter instead of crashing.
export interface NetworkStats {
  domains: number;
  events: number;
}

export async function getNetworkStats(): Promise<NetworkStats | null> {
  try {
    const rows = await sql`
      SELECT
        (SELECT COUNT(*) FROM domains) AS domains,
        (SELECT COUNT(*) FROM events)  AS events
    ` as unknown as { domains: string; events: string }[];
    const row = rows[0];
    if (!row) return null;
    return {
      domains: Number(row.domains),
      events: Number(row.events),
    };
  } catch {
    return null;
  }
}

// Daily event counts over the last N days — used for the sparkline
// on the seal page. Returns buckets in chronological order.
export async function getDailyActivity(
  domainId: number,
  days: number = 30
): Promise<{ date: string; count: number }[]> {
  const rows = await sql`
    SELECT
      to_char(date_trunc('day', witnessed_at), 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS count
    FROM events
    WHERE domain_id = ${domainId}
      AND witnessed_at >= NOW() - (${days} || ' days')::interval
    GROUP BY 1
    ORDER BY 1 ASC
  ` as unknown as { date: string; count: number }[];
  return rows;
}
