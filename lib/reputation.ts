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

// ── Spamhaus DBL (domain block list) ─────────────────────────
//
// DBL lists domains caught in active spam / phishing / malware
// campaigns. Query is a reverse DNS lookup — `{domain}.{zone}` →
// A record means listed.
//
// Zone selection:
//   public  — `dbl.spamhaus.org`. Spamhaus refuses queries from open
//             resolvers (Vercel runtime falls under this), returning
//             a 127.255.255.x sentinel. Effectively unusable from
//             serverless without a private/upstream resolver.
//   DQS     — `{key}.dbl.dq.spamhaus.net`. Free tier up to 100k/day
//             after registering at https://www.spamhaus.com/free-trial/.
//
// We only run DBL when SPAMHAUS_DQS_KEY is configured. Without a key,
// `isOnDbl` short-circuits to false with no DNS round-trip — the
// remaining anti-abuse layers (MX, rate limit, mutuality, diversity,
// tenure, free-mail exclusion) already cover the attack surface.
//
// Response semantics (https://www.spamhaus.org/dbl/):
//   127.0.1.2 .. 127.0.1.99   — spam / phish / malware  (listed)
//   127.0.1.255               — rate-limited            (refused → fail-open)
//   127.255.255.252 .. .255   — public / open resolver blocked, typing
//                               error, or volume overage. Treated as
//                               refused, NOT as a listing.
//   NXDOMAIN / no record      — not listed
//
// Cached 24h. Listings come and go; we re-check daily so cleaned-up
// domains aren't punished forever. Refused responses are never cached.

const DBL_TTL_MS = 24 * 60 * 60 * 1000;
const DBL_DQS_KEY = process.env.SPAMHAUS_DQS_KEY?.trim() || "";
const DBL_ENABLED = DBL_DQS_KEY.length > 0;
const DBL_ZONE = DBL_ENABLED
  ? `${DBL_DQS_KEY}.dbl.dq.spamhaus.net`
  : "dbl.spamhaus.org";

type DblRow = {
  dbl_listed: boolean | null;
  dbl_checked_at: string | null;
};

async function readDblCache(domain: string): Promise<DblRow | null> {
  try {
    const rows = (await sql`
      SELECT dbl_listed, dbl_checked_at
      FROM domain_reputation_cache
      WHERE domain = ${domain}
      LIMIT 1
    `) as unknown as DblRow[];
    return rows[0] ?? null;
  } catch (err) {
    console.error("[reputation] readDblCache failed", { domain, err });
    return null;
  }
}

async function writeDblCache(domain: string, listed: boolean): Promise<void> {
  try {
    await sql`
      INSERT INTO domain_reputation_cache (domain, dbl_listed, dbl_checked_at, updated_at)
      VALUES (${domain}, ${listed}, NOW(), NOW())
      ON CONFLICT (domain) DO UPDATE SET
        dbl_listed     = EXCLUDED.dbl_listed,
        dbl_checked_at = NOW(),
        updated_at     = NOW()
    `;
  } catch (err) {
    console.error("[reputation] writeDblCache failed", { domain, err });
  }
}

class DblRefusedError extends Error {
  constructor(public readonly addrs: string[]) {
    super(`DBL refused query: ${addrs.join(",")}`);
  }
}

function isRefusalCode(ip: string): boolean {
  // 127.0.1.255 = rate-limited.
  // 127.255.255.x = public/open resolver blocked, typing error, or volume
  // overage. All non-listings, all "try again from a different path."
  return ip === "127.0.1.255" || ip.startsWith("127.255.255.");
}

async function dblLookupLive(domain: string): Promise<boolean> {
  try {
    const addrs = await withTimeout(
      dns.resolve4(`${domain}.${DBL_ZONE}`),
      DNS_TIMEOUT_MS,
    );
    if (addrs.every(isRefusalCode)) {
      throw new DblRefusedError(addrs);
    }
    // Any non-refusal 127.0.1.x response is a real listing.
    return addrs.some((a) => !isRefusalCode(a));
  } catch (err) {
    if (err instanceof DblRefusedError) throw err;
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      return false;
    }
    throw err;
  }
}

/**
 * True if `domain` is listed on Spamhaus DBL. Cached 24h. Fail-open
 * on unclassified errors so a flaky DNSBL resolver doesn't drop
 * legitimate senders. Short-circuits to false when no DQS key is
 * configured — running DBL against the public zone from a serverless
 * runtime returns only refusals, so the lookup is pure overhead.
 */
export async function isOnDbl(domain: string): Promise<boolean> {
  if (!domain || domain === "unknown") return false;
  if (!DBL_ENABLED) return false;
  const cached = await readDblCache(domain);
  if (cached && cached.dbl_listed !== null && cached.dbl_checked_at) {
    const age = Date.now() - new Date(cached.dbl_checked_at).getTime();
    if (age < DBL_TTL_MS) return cached.dbl_listed;
  }
  try {
    const listed = await dblLookupLive(domain);
    await writeDblCache(domain, listed);
    return listed;
  } catch (err) {
    if (err instanceof DblRefusedError) {
      // Public-resolver refusal or rate-limit. Do NOT cache — we want
      // the next lookup to retry (ideally through a DQS key once one
      // is configured). Fail-open so legitimate mail is not dropped.
      console.warn("[reputation] DBL refused lookup, failing open", {
        domain,
        addrs: err.addrs,
      });
      return false;
    }
    console.error("[reputation] dblLookup unclassified error", { domain, err });
    return false;
  }
}

// ── Certificate Transparency log — domain age without WHOIS ──
//
// CT logs are append-only public records of every TLS cert issued
// by a CA that participates in CT (effectively all of them since
// ~2018). The earliest cert ever issued for a domain is a strong
// lower-bound proxy for domain age — much more reliable than WHOIS
// (which is rate-limited, inconsistent across TLDs, and often
// privacy-masked) and 100% free via crt.sh.
//
// Cached forever after a successful lookup: a domain's first-ever
// certificate does not change. Failed lookups are not cached so we
// retry later.

const CT_LOOKUP_TIMEOUT_MS = 8000;

type CertRow = {
  first_cert_at: string | null;
  cert_checked_at: string | null;
};

async function readCertCache(domain: string): Promise<CertRow | null> {
  try {
    const rows = (await sql`
      SELECT first_cert_at, cert_checked_at
      FROM domain_reputation_cache
      WHERE domain = ${domain}
      LIMIT 1
    `) as unknown as CertRow[];
    return rows[0] ?? null;
  } catch (err) {
    console.error("[reputation] readCertCache failed", { domain, err });
    return null;
  }
}

async function writeCertCache(
  domain: string,
  firstCertAt: Date | null,
): Promise<void> {
  try {
    await sql`
      INSERT INTO domain_reputation_cache (domain, first_cert_at, cert_checked_at, updated_at)
      VALUES (${domain}, ${firstCertAt?.toISOString() ?? null}, NOW(), NOW())
      ON CONFLICT (domain) DO UPDATE SET
        first_cert_at    = EXCLUDED.first_cert_at,
        cert_checked_at  = NOW(),
        updated_at       = NOW()
    `;
  } catch (err) {
    console.error("[reputation] writeCertCache failed", { domain, err });
  }
}

/**
 * Cache-only CT-log age read. Returns the stored earliest-cert date
 * without issuing any network call — safe to use on sync render
 * paths (seal page, scoring refresh). Returns null if we've never
 * looked up this domain or if the cached entry recorded a miss.
 */
export async function cachedFirstCertAt(domain: string): Promise<Date | null> {
  if (!domain || domain === "unknown") return null;
  const cached = await readCertCache(domain);
  if (cached && cached.first_cert_at) return new Date(cached.first_cert_at);
  return null;
}

/**
 * Network-backed CT-log lookup via crt.sh. Populates the cache so
 * future `cachedFirstCertAt()` reads are instant.
 *
 * NOTE: crt.sh is rate-limited and occasionally slow (seconds).
 * Call this from deferred / admin paths only — never from the
 * synchronous inbound or seal-page render paths. Cached forever on
 * a positive result; previously-checked misses are retried every
 * 30 days in case the domain finally provisioned a cert.
 */
export async function fetchFirstCertAt(domain: string): Promise<Date | null> {
  if (!domain || domain === "unknown") return null;
  const cached = await readCertCache(domain);
  if (cached && cached.cert_checked_at) {
    if (cached.first_cert_at) return new Date(cached.first_cert_at);
    const age = Date.now() - new Date(cached.cert_checked_at).getTime();
    if (age < 30 * 24 * 60 * 60 * 1000) return null;
  }
  try {
    const res = await withTimeout(
      fetch(
        `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json&exclude=expired`,
        { headers: { Accept: "application/json" } },
      ),
      CT_LOOKUP_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`crt.sh ${res.status}`);
    const rows = (await res.json()) as Array<{ not_before?: string }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      await writeCertCache(domain, null);
      return null;
    }
    let min: Date | null = null;
    for (const r of rows) {
      if (!r.not_before) continue;
      const d = new Date(r.not_before);
      if (Number.isNaN(d.getTime())) continue;
      if (!min || d < min) min = d;
    }
    await writeCertCache(domain, min);
    return min;
  } catch (err) {
    console.error("[reputation] fetchFirstCertAt failed", { domain, err });
    return null;
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
