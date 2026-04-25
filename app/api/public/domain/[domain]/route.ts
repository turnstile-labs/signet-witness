/**
 * Public JSON lookup for a domain's current Witnessed state.
 *
 * Mirrors the state machine used by /b/[domain] but returns a compact
 * JSON payload suitable for the browser extension's read-side pill and
 * any future third-party integrations.
 *
 * Guarantees (enforced by this route, not by convention):
 *
 *   1. Never exposes receiver identities. Only the *count* of unique
 *      receivers ever leaves this endpoint. Receiver-domain identities
 *      are personal data; same GDPR invariant as the seal page.
 *   2. Treats denylisted domains as `unclaimed` with zero data so we
 *      don't leak the fact that a domain opted out.
 *   3. Wide-open CORS — this route returns strictly public information
 *      that already lives on /b/[domain]. Gmail, Outlook, and any other
 *      web client can call it cross-origin without preflight friction.
 *   4. Aggressively edge-cached (5 min fresh, 1 h stale-while-revalidate)
 *      so mass-scanned inboxes don't melt the database.
 */

import { NextResponse } from "next/server";
import { getDomain, getReceiverCount, isDenylisted } from "@/lib/db";
import {
  computeVerified,
  getDomainScore,
  trustTierFromScore,
  type TrustTier,
} from "@/lib/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public-facing state space. `unclaimed` is the absence-of-data state
// (no domain row in the registry); `verified` and `building` come from
// `trustTierFromScore` which collapses the legacy `pending` tier into
// `building` on every public surface as of v12.
type PublicState = TrustTier | "unclaimed";

interface PublicPayload {
  domain: string;
  state: PublicState;
  trustIndex: number | null;
  verifiedEventCount: number;
  mutualCounterparties: number;
  uniqueReceivers: number;
  inboundCount: number | null;
  firstSeen: string | null;
  updatedAt: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const CACHE_HEADERS: Record<string, string> = {
  "Cache-Control":
    "public, s-maxage=300, stale-while-revalidate=3600, max-age=0",
};

function normalize(raw: string): string {
  return decodeURIComponent(raw).toLowerCase().trim();
}

function isLikelyDomain(d: string): boolean {
  // Same shape check we apply on the landing page search: at least one
  // dot, no whitespace, reasonable length. Keeps garbage out of the DB.
  return (
    d.length > 0 &&
    d.length < 254 &&
    !/\s/.test(d) &&
    d.includes(".") &&
    !d.startsWith(".") &&
    !d.endsWith(".")
  );
}

function emptyPayload(domain: string): PublicPayload {
  return {
    domain,
    state: "unclaimed",
    trustIndex: null,
    verifiedEventCount: 0,
    mutualCounterparties: 0,
    uniqueReceivers: 0,
    inboundCount: null,
    firstSeen: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> },
): Promise<Response> {
  const { domain: raw } = await params;
  const domain = normalize(raw);

  if (!isLikelyDomain(domain)) {
    return NextResponse.json(
      { error: "invalid domain" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Denylist comes first: an opted-out domain presents as `unclaimed`
  // with zero data so we never leak the fact of an opt-out.
  if (await isDenylisted(domain)) {
    return NextResponse.json(emptyPayload(domain), {
      headers: { ...CORS_HEADERS, ...CACHE_HEADERS },
    });
  }

  const record = await getDomain(domain);

  if (!record) {
    const inboundCount = await getReceiverCount(domain);
    const payload: PublicPayload = {
      ...emptyPayload(domain),
      inboundCount,
    };
    return NextResponse.json(payload, {
      headers: { ...CORS_HEADERS, ...CACHE_HEADERS },
    });
  }

  const score = await getDomainScore(record.id, record.domain);
  const verified = computeVerified(score, record.grandfathered_verified);
  const state = trustTierFromScore(score, verified);

  const payload: PublicPayload = {
    domain,
    state,
    trustIndex: score?.trust_index ?? null,
    verifiedEventCount:
      score?.verified_event_count ?? record.event_count ?? 0,
    mutualCounterparties: score?.mutual_counterparties ?? 0,
    uniqueReceivers: score?.counterparty_count ?? 0,
    inboundCount: null,
    firstSeen: record.first_seen,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { ...CORS_HEADERS, ...CACHE_HEADERS },
  });
}
