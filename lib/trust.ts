// ─────────────────────────────────────────────────────────────
// Domain scoring — Layer 1+.
//
// Raw `domains.event_count` is the naive count of DKIM-valid emails
// we've witnessed. It's a lousy quality signal on its own: an attacker
// with a valid DKIM key can pump it trivially (before Layer 0) and,
// even after Layer 0, can pad it by sealing emails to real but low-value receivers
// (free-mail accounts, their own sister domains) over and over.
//
// This module computes a *quality-adjusted* view of a sender:
//
//   • verified_event_count    events toward any non-throttled receiver.
//                             The denominator for everything else.
//                             Free-mail receivers (gmail.com, …) count:
//                             they're real customer-facing interactions.
//                             Free-mail senders are rejected at intake
//                             (see FREE_MAIL_DOMAINS below) — that's
//                             the sender side only. The diversity-Gini
//                             sub-score and the MIN_MUTUALS gate handle
//                             the "pump 100 gmail aliases" attack
//                             independently of intake filtering.
//   • counterparty_count      distinct receiver domains, all-time.
//   • mutual_counterparties   the anti-fake signal. These are receivers
//                             who are *themselves* senders and who have
//                             sealed this domain back as a receiver. A
//                             mutual edge requires the counterparty to
//                             have (a) a DKIM-signing MTA, (b) its own
//                             domain, and (c) incentive to add seal@
//                             to outbound mail — three things you can't
//                             manufacture cheaply.
//   • diversity               1 − Gini(events_per_receiver). Prevents
//                             "pump one friendly receiver 500 times."
//                             0 = monoculture, 1 = perfectly even.
//   • tenure_days             age signal. max(first_seen, first_cert_at)
//                             where first_cert_at comes from Certificate
//                             Transparency logs — cheaper and more
//                             reliable than WHOIS across TLDs.
//
// The five roll up into a single public `trust_index ∈ [0, 100]`. The
// weights encode the operator's judgement of how hard each signal is
// to fake at low cost. See `computeTrustIndex` below for the math.
//
// The table is refreshed lazily: `insertEvent()` in lib/db.ts flips
// `domain_trust.stale = TRUE` on every accepted event, and
// `getDomainMetrics()` triggers a recompute when the row is stale or
// older than SCORE_TTL_MS. Compute is a handful of SQL aggregates —
// runs in under 50ms on current data shapes.
// ─────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";
import { cachedFirstCertAt } from "./reputation";

let _sql: ReturnType<typeof neon> | null = null;
function sql(...args: Parameters<ReturnType<typeof neon>>) {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
    if (!url) throw new Error("DATABASE_URL or STORAGE_URL is not set");
    _sql = neon(url);
  }
  return (_sql as ReturnType<typeof neon>)(...args);
}

// Consumer-grade free-mail providers. The inbound webhook rejects any
// DKIM-passing email whose From: domain is in this set — multi-tenant
// mailbox providers can't be a seal subject because there's no single
// owner who could claim or speak for the domain.
//
// Free-mail RECEIVERS are unaffected: acme.com → alice@gmail.com is
// real signal for acme.com and flows through normally.
//
// Exported so other surfaces (popup labels, seal-page copy) can share
// the same boundary definition without re-deriving it.
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "fastmail.com",
  "tutanota.com",
  "pm.me",
]);

// Read-through TTL for domain_trust rows. Exported so any reader that
// keeps its own staleness check (e.g. /ops, which fetches a leaderboard
// in one shot rather than going through getDomainMetrics per-row) uses
// the same window the per-domain accessor does — drift here would
// silently let two surfaces disagree on whether a row is fresh.
export const SCORE_TTL_MS = 24 * 60 * 60 * 1000;

export interface DomainMetrics {
  verified_event_count: number;
  counterparty_count: number;
  mutual_counterparties: number;
  diversity: number;
  tenure_days: number;
  trust_index: number;
  computed_at: string;
}

// ── Verified gating ──────────────────────────────────────────
//
// The new "verified" badge requires BOTH a quality-composite score
// above VERIFIED_INDEX *and* at least MIN_MUTUALS mutual counterparties.
// The mutuality floor is the anti-fake insurance: an attacker can pump
// activity and diversity with DKIM-valid mail to real-but-unrelated
// MX-backed domains, but cannot cheaply manufacture bidirectional
// relationships with other DKIM-signing senders.
//
// Grandfathered domains — those that met the pre-Layer-2 rule (90d +
// 10 events) — stay verified regardless of the new score, so nobody
// loses a badge when the metric changes. Operators can clear the
// grandfather flag per-domain to de-verify a proven abuser.

export const VERIFIED_INDEX = 65;
export const MIN_MUTUALS = 3;

// Module-private — only ever appears nested in `VerifiedState.reason`,
// and consumers branch on the boolean `isVerified`, not on the reason
// string. Promote to an export only if a caller starts switching on it.
type VerifiedReason = "score" | "grandfathered";

export interface VerifiedState {
  isVerified: boolean;
  reason: VerifiedReason | null;
}

export function computeVerified(
  metrics: DomainMetrics | null,
  grandfathered: boolean,
): VerifiedState {
  if (
    metrics &&
    metrics.trust_index >= VERIFIED_INDEX &&
    metrics.mutual_counterparties >= MIN_MUTUALS
  ) {
    return { isVerified: true, reason: "score" };
  }
  if (grandfathered) {
    return { isVerified: true, reason: "grandfathered" };
  }
  return { isVerified: false, reason: null };
}

// Public-facing trust tier — drives the badge palette, the seal-page
// state block, the extension popup chip, and the public JSON API. Two
// tiers, deliberately:
//
//   verified  → passed the composite trust-index gate AND the mutual-
//               counterparty floor (or grandfathered).
//   building  → everything else with a registered domain row,
//               including the rare case of a domain whose only
//               counterparty has been GDPR-erased (which leaves the
//               sender with zero rows in `events`). The /ops dashboard
//               splits that case out as "Inactive" for operator
//               forensics; everything public stays binary because the
//               distinction isn't actionable for a normal reader.
//
// The string keys mirror the user-visible labels exactly ("Verified",
// "Building") so a reader of the code never has to translate the
// internal token to the rendered word — keeps the entire stack from
// drifting between codebase and UI.
export type TrustTier = "verified" | "building";

export function trustTierFromMetrics(
  metrics: DomainMetrics | null,
  verified: VerifiedState,
): TrustTier {
  // `metrics` isn't read today (verified.isVerified already encodes
  // the trust-index gate via computeVerified), but it stays in the
  // signature so a future "near-verified" tier or operator override
  // can branch on raw counts without breaking every caller.
  void metrics;
  if (verified.isVerified) return "verified";
  return "building";
}

// ── Trust-index math ──────────────────────────────────────────
//
// Each sub-score is 0..100. Weighted sum, clamped, rounded.
//
//   activity   35%   log(1 + verified_events) / log(1 + ACTIVITY_CAP),
//                    capped so a wall-of-emails attacker gets diminishing
//                    returns past ~200 quality events.
//   mutual     25%   min(mutuals, MUTUAL_CAP) / MUTUAL_CAP. Linear.
//                    The strongest anti-fake signal; 20 mutuals is
//                    "real business."
//   tenure     20%   min(days, TENURE_CAP_DAYS) / TENURE_CAP_DAYS.
//                    Linear, 2-year cap.
//   diversity  20%   already 0..1. Rewards breadth, punishes pump.
//
// Weights and caps live as named constants so operator-facing surfaces
// (the /ops legend, the seal page explainer) can render the same numbers
// the math actually uses — change here and every legend updates in
// lockstep. The four weights are required to sum to 1 — `_WEIGHT_SUM`
// is exported only for the runtime invariant check below.

export const ACTIVITY_WEIGHT = 0.35;
export const MUTUAL_WEIGHT = 0.25;
export const TENURE_WEIGHT = 0.2;
export const DIVERSITY_WEIGHT = 0.2;

// Cap inputs — past these the sub-score saturates at 1.0 and additional
// signal stops moving the index. Picked to make "real established
// business" hit ~100: 200 quality emails, 20 distinct mutual senders,
// 2 years of tenure.
export const ACTIVITY_CAP = 200;
export const MUTUAL_CAP = 20;
export const TENURE_CAP_DAYS = 730;

// Compile-time-ish invariant: weights must sum to 1, otherwise the
// composite stops being a 0..100 measure. Tested in trust.test.ts.
export const _WEIGHT_SUM =
  ACTIVITY_WEIGHT + MUTUAL_WEIGHT + TENURE_WEIGHT + DIVERSITY_WEIGHT;

export function computeTrustIndex(parts: {
  verified_event_count: number;
  mutual_counterparties: number;
  diversity: number;
  tenure_days: number;
}): number {
  const activityRaw =
    Math.log1p(parts.verified_event_count) / Math.log1p(ACTIVITY_CAP);
  const activity = Math.min(1, Math.max(0, activityRaw)) * 100;

  const mutual = Math.min(1, parts.mutual_counterparties / MUTUAL_CAP) * 100;
  const tenure = Math.min(1, parts.tenure_days / TENURE_CAP_DAYS) * 100;
  const diversity = Math.min(1, Math.max(0, parts.diversity)) * 100;

  const composite =
    ACTIVITY_WEIGHT * activity +
    MUTUAL_WEIGHT * mutual +
    TENURE_WEIGHT * tenure +
    DIVERSITY_WEIGHT * diversity;
  return Math.max(0, Math.min(100, Math.round(composite)));
}

// ── Refresh ───────────────────────────────────────────────────

interface RawAggregates {
  verified_event_count: number;
  counterparty_count: number;
  mutual_counterparties: number;
  diversity: number;
  tenure_days: number;
}

async function aggregate(domainId: number): Promise<RawAggregates | null> {
  // One round-trip: five aggregates plus the mutuality self-join.
  try {
    const rows = (await sql`
      WITH me AS (
        SELECT id, domain, first_seen FROM domains WHERE id = ${domainId}
      ),
      receiver_events AS (
        SELECT receiver_domain, COUNT(*)::int AS n
        FROM events
        WHERE domain_id = ${domainId}
        GROUP BY receiver_domain
      ),
      -- Gini coefficient on (events per receiver). Window functions
      -- can't be aggregate args, so we rank first then aggregate.
      ranked AS (
        SELECT
          n,
          row_number() OVER (ORDER BY n ASC) AS r,
          COUNT(*) OVER () AS total_n
        FROM receiver_events
      ),
      gini AS (
        -- Gini is undefined for a single data point. We coerce it to
        -- 1 (= maximum inequality) so diversity = 1 - g = 0 — a single
        -- receiver is zero spread, not perfect equality.
        SELECT
          CASE
            WHEN COALESCE(MAX(total_n), 0) <= 1 OR COALESCE(SUM(n), 0) = 0
              THEN 1::numeric
            ELSE
              (2::numeric * SUM(r * n)::numeric
               - (MAX(total_n) + 1)::numeric * SUM(n)::numeric)
              / (MAX(total_n) * SUM(n))::numeric
          END AS g
        FROM ranked
      ),
      mutuals AS (
        SELECT COUNT(DISTINCT e1.receiver_domain)::int AS n
        FROM events e1
        WHERE e1.domain_id = ${domainId}
          AND EXISTS (
            SELECT 1
            FROM events e2
            JOIN domains d2 ON d2.id = e2.domain_id
            WHERE d2.domain = e1.receiver_domain
              AND e2.receiver_domain = (SELECT domain FROM me)
          )
      )
      SELECT
        COALESCE((SELECT SUM(n)::int FROM receiver_events), 0)          AS verified_event_count,
        COALESCE((SELECT COUNT(*)::int FROM receiver_events), 0)        AS counterparty_count,
        COALESCE((SELECT n FROM mutuals), 0)                            AS mutual_counterparties,
        1 - COALESCE((SELECT g FROM gini), 0)::float                    AS diversity,
        -- Total days elapsed. Date-subtraction returns an int so we
        -- avoid EXTRACT(DAY FROM interval), which only pulls the day
        -- component of a composite "3 years 2 months 5 days" value.
        GREATEST(
          0,
          (NOW()::date - (SELECT first_seen FROM me)::date)
        )                                                               AS tenure_days
    `) as unknown as Array<{
      verified_event_count: number;
      counterparty_count: number;
      mutual_counterparties: number;
      diversity: number;
      tenure_days: number;
    }>;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[trust] aggregate failed", { domainId, err });
    return null;
  }
}

/**
 * Recompute the `domain_trust` row for this domain from scratch.
 * Pulls fresh CT-log tenure (lazy; falls back to first_seen on miss)
 * and persists. Called by getDomainMetrics() when stale.
 */
export async function refreshDomainMetrics(
  domainId: number,
  domainName: string,
): Promise<DomainMetrics | null> {
  const agg = await aggregate(domainId);
  if (!agg) return null;

  // Tenure: first_seen gives us "seen by us," CT logs give us "seen
  // by the internet." Use whichever is older — tenure cannot move
  // backwards when a new signal arrives. CT-log read is cache-only
  // here to keep scoring inline-fast; the cache is warmed from the
  // deferred backfill / admin path (fetchFirstCertAt).
  let tenureDays = agg.tenure_days;
  try {
    const cert = await cachedFirstCertAt(domainName);
    if (cert) {
      const certDays = Math.floor(
        (Date.now() - cert.getTime()) / (1000 * 60 * 60 * 24),
      );
      tenureDays = Math.max(tenureDays, certDays);
    }
  } catch {
    // cache read already logs + swallows; don't block scoring.
  }

  const trust = computeTrustIndex({
    verified_event_count: agg.verified_event_count,
    mutual_counterparties: agg.mutual_counterparties,
    diversity: agg.diversity,
    tenure_days: tenureDays,
  });

  try {
    await sql`
      INSERT INTO domain_trust (
        domain_id, verified_event_count, counterparty_count,
        mutual_counterparties, diversity, tenure_days, trust_index,
        stale, computed_at
      )
      VALUES (
        ${domainId}, ${agg.verified_event_count}, ${agg.counterparty_count},
        ${agg.mutual_counterparties}, ${agg.diversity}, ${tenureDays}, ${trust},
        FALSE, NOW()
      )
      ON CONFLICT (domain_id) DO UPDATE SET
        verified_event_count   = EXCLUDED.verified_event_count,
        counterparty_count     = EXCLUDED.counterparty_count,
        mutual_counterparties  = EXCLUDED.mutual_counterparties,
        diversity              = EXCLUDED.diversity,
        tenure_days            = EXCLUDED.tenure_days,
        trust_index            = EXCLUDED.trust_index,
        stale                  = FALSE,
        computed_at            = NOW()
    `;
  } catch (err) {
    console.error("[trust] persist failed", { domainId, err });
    return null;
  }

  return {
    verified_event_count: agg.verified_event_count,
    counterparty_count: agg.counterparty_count,
    mutual_counterparties: agg.mutual_counterparties,
    diversity: agg.diversity,
    tenure_days: tenureDays,
    trust_index: trust,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Read-through accessor used by the seal page. Returns cached metrics
 * when fresh, triggers recompute when stale or TTL-expired.
 *
 * Failure mode: if the cache is missing and a recompute fails, returns
 * null — caller should fall back to raw `domains.event_count` so the
 * page still renders.
 */
export async function getDomainMetrics(
  domainId: number,
  domainName: string,
): Promise<DomainMetrics | null> {
  try {
    const rows = (await sql`
      SELECT verified_event_count, counterparty_count, mutual_counterparties,
             diversity::float AS diversity, tenure_days, trust_index,
             stale, computed_at
      FROM domain_trust
      WHERE domain_id = ${domainId}
      LIMIT 1
    `) as unknown as Array<{
      verified_event_count: number;
      counterparty_count: number;
      mutual_counterparties: number;
      diversity: number;
      tenure_days: number;
      trust_index: number;
      stale: boolean;
      computed_at: string;
    }>;
    const row = rows[0];
    if (row && !row.stale) {
      const age = Date.now() - new Date(row.computed_at).getTime();
      if (age < SCORE_TTL_MS) {
        return {
          verified_event_count: row.verified_event_count,
          counterparty_count: row.counterparty_count,
          mutual_counterparties: row.mutual_counterparties,
          diversity: row.diversity,
          tenure_days: row.tenure_days,
          trust_index: row.trust_index,
          computed_at: row.computed_at,
        };
      }
    }
  } catch (err) {
    // Table missing (migration not yet run in prod) → fall through to
    // compute; compute will hit the same error but we'll log once.
    console.error("[trust] getDomainMetrics read failed", { domainId, err });
  }

  return refreshDomainMetrics(domainId, domainName);
}
