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
