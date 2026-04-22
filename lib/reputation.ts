// ─────────────────────────────────────────────────────────────
// Anti-abuse primitives — Layer 0.
//
// DKIM proves "a mail server holding $domain's private key signed
// this message." It does NOT prove the receiver exists, or that the
// sender is running real commerce. Without the checks in this file,
// an attacker with a valid DKIM key (which is trivial to set up on
// any domain they control) could mint a pristine-looking witness
// record by blasting seal@witnessed.cc with DKIM-signed emails
// addressed to nonexistent receivers.
//
// Layer 0 closes the 95th-percentile attack by refusing to count
// events that fail two cheap structural checks:
//
//   1. receiverHasMx(primaryReceiver) — the addressed domain has no
//      mail exchange record. Either a typo, a sinkhole, or a spoof
//      target picked because nobody will ever bounce the email back.
//   2. isRateLimited(senderDomain)    — the sender is pushing an
//      extraordinary volume of events. Real commerce, even at
//      enterprise scale, plateaus well below these thresholds.
//
// Events that fail either check go into `events_throttled` for ops
// review. They never touch `domains.event_count` and are never joined
// to public render paths.
//
// Fail-open on transient errors: DNS hiccups must not drop legitimate
// email. Any unexpected error logs and returns the permissive value.
// ─────────────────────────────────────────────────────────────

import { promises as dns } from "dns";
import { neon } from "@neondatabase/serverless";

// Lazy, shared with lib/db.ts pattern — keeps `next build` usable
// without DATABASE_URL at compile time.
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

// ── MX existence check ───────────────────────────────────────
//
// Positive MX answers are cached for 7 days — MX records change
// rarely and a legitimate domain losing MX is its own problem worth
// re-verifying on a weekly cadence. Negative answers are cached for
// only 24 hours so a new domain that comes online (or a transient
// DNS issue) is re-tried quickly rather than permanently excluded.

const MX_TTL_POSITIVE_MS = 7 * 24 * 60 * 60 * 1000;
const MX_TTL_NEGATIVE_MS = 1 * 24 * 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;

type MxRow = {
  mx_exists: boolean | null;
  mx_checked_at: string | null;
};

async function readMxCache(domain: string): Promise<MxRow | null> {
  try {
    const rows = (await sql`
      SELECT mx_exists, mx_checked_at
      FROM domain_reputation_cache
      WHERE domain = ${domain}
      LIMIT 1
    `) as unknown as MxRow[];
    return rows[0] ?? null;
  } catch (err) {
    console.error("[reputation] readMxCache failed", { domain, err });
    return null;
  }
}

async function writeMxCache(domain: string, exists: boolean): Promise<void> {
  try {
    await sql`
      INSERT INTO domain_reputation_cache (domain, mx_exists, mx_checked_at, updated_at)
      VALUES (${domain}, ${exists}, NOW(), NOW())
      ON CONFLICT (domain) DO UPDATE SET
        mx_exists      = EXCLUDED.mx_exists,
        mx_checked_at  = NOW(),
        updated_at     = NOW()
    `;
  } catch (err) {
    // Cache write failures are not fatal — the lookup already resolved.
    console.error("[reputation] writeMxCache failed", { domain, err });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("dns timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function resolveMxLive(domain: string): Promise<boolean> {
  try {
    const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    return Array.isArray(records) && records.length > 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // ENOTFOUND / ENODATA / NXDOMAIN are all "the domain has no MX" —
    // authoritative negative answers. Everything else (timeout, SERVFAIL,
    // EAI_AGAIN) we treat as unknown and fail-open below.
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      return false;
    }
    throw err;
  }
}

/**
 * True if `domain` has at least one MX record. Uses a 7d/1d positive/
 * negative TTL cache to avoid hammering DNS on high-frequency senders.
 *
 * Fail-open on unclassified errors: a transient DNS hiccup must not
 * drop legitimate email.
 */
export async function receiverHasMx(domain: string): Promise<boolean> {
  if (!domain || domain === "unknown") return true;
  const cached = await readMxCache(domain);
  if (cached && cached.mx_exists !== null && cached.mx_checked_at) {
    const age = Date.now() - new Date(cached.mx_checked_at).getTime();
    const ttl = cached.mx_exists ? MX_TTL_POSITIVE_MS : MX_TTL_NEGATIVE_MS;
    if (age < ttl) return cached.mx_exists;
  }
  try {
    const exists = await resolveMxLive(domain);
    await writeMxCache(domain, exists);
    return exists;
  } catch (err) {
    console.error("[reputation] resolveMx unclassified error", { domain, err });
    // Fail-open: if we truly can't tell, assume MX exists. Legitimate
    // mail must not be silently dropped because our DNS path flaked.
    return true;
  }
}

// ── Rate limit ───────────────────────────────────────────────
//
// Thresholds are deliberately permissive. Real commerce — even a
// 100-person sales org CCing seal@ on every outbound — plateaus
// well below these numbers. Spray-and-pray spoofing sits an order
// of magnitude above. Any legitimate sender that bumps the ceiling
// should become a paid customer with a tier-based lift.

const HOURLY_LIMIT = 500;
const DAILY_LIMIT = 5000;

/**
 * True if this sender has exceeded the hourly or daily event ceiling.
 * Counts both accepted events and previously-throttled events so an
 * attacker can't keep pushing once they hit the wall.
 */
export async function isRateLimited(senderDomain: string): Promise<boolean> {
  if (!senderDomain) return false;
  try {
    const rows = (await sql`
      SELECT
        COALESCE((
          SELECT COUNT(*)::int FROM events e
          JOIN domains d ON d.id = e.domain_id
          WHERE d.domain = ${senderDomain}
            AND e.witnessed_at >= NOW() - INTERVAL '1 hour'
        ), 0)
        + COALESCE((
          SELECT COUNT(*)::int FROM events_throttled t
          WHERE t.sender_domain = ${senderDomain}
            AND t.witnessed_at >= NOW() - INTERVAL '1 hour'
        ), 0) AS hourly,
        COALESCE((
          SELECT COUNT(*)::int FROM events e
          JOIN domains d ON d.id = e.domain_id
          WHERE d.domain = ${senderDomain}
            AND e.witnessed_at >= NOW() - INTERVAL '1 day'
        ), 0)
        + COALESCE((
          SELECT COUNT(*)::int FROM events_throttled t
          WHERE t.sender_domain = ${senderDomain}
            AND t.witnessed_at >= NOW() - INTERVAL '1 day'
        ), 0) AS daily
    `) as unknown as { hourly: number; daily: number }[];
    const hourly = rows[0]?.hourly ?? 0;
    const daily = rows[0]?.daily ?? 0;
    return hourly >= HOURLY_LIMIT || daily >= DAILY_LIMIT;
  } catch (err) {
    console.error("[reputation] isRateLimited failed", { senderDomain, err });
    // Fail-open — don't let a query error block writes.
    return false;
  }
}

// ── Throttle writer ──────────────────────────────────────────

export type ThrottleReason =
  | "receiver_no_mx"
  | "rate_limit"
  | "receiver_blocklist"
  | "concentration";

/**
 * Record a throttled event. Never affects public counts. Retained
 * for forensics and ops review.
 */
export async function recordThrottled(
  senderDomain: string,
  receiverDomain: string,
  dkimHash: string,
  reason: ThrottleReason
): Promise<void> {
  try {
    await sql`
      INSERT INTO events_throttled (sender_domain, receiver_domain, dkim_hash, reason)
      VALUES (${senderDomain}, ${receiverDomain}, ${dkimHash}, ${reason})
    `;
  } catch (err) {
    // Best-effort — a failed forensic write shouldn't propagate.
    console.error("[reputation] recordThrottled failed", {
      senderDomain,
      receiverDomain,
      reason,
      err,
    });
  }
}
