import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { neon } from "@neondatabase/serverless";
import { fetchFirstCertAt } from "@/lib/reputation";

// Admin backfill for the CT-log cache. Two modes:
//
//   GET /api/admin/warm-ct?token=$STATS_TOKEN
//       → iterate every domain missing a first_cert_at entry and
//         warm it sequentially. Bounded by MAX_PER_CALL so a single
//         invocation can't exceed the runtime's max duration even
//         on a large registry.
//
//   GET /api/admin/warm-ct?token=$STATS_TOKEN&domain=acme.com
//       → warm one specific domain. Useful for targeted re-fetches
//         after a misfire or for manually proving the pipeline.
//
// Not linked from anywhere. Auth reuses STATS_TOKEN — the same
// rotating secret that guards /ops. Rotate to revoke. This endpoint
// only ever writes to domain_reputation_cache.

export const dynamic = "force-dynamic";
// 60s max duration so we can chain a handful of 20s crt.sh calls in
// one invocation. Vercel Pro; Hobby will cap at 10s which limits this
// to a single domain per call — acceptable.
export const maxDuration = 60;

const MAX_PER_CALL = 20;

let _sql: ReturnType<typeof neon> | null = null;
function sql(...args: Parameters<ReturnType<typeof neon>>) {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
    if (!url) throw new Error("DATABASE_URL or STORAGE_URL is not set");
    _sql = neon(url);
  }
  return (_sql as ReturnType<typeof neon>)(...args);
}

function tokenMatches(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const expected = process.env.STATS_TOKEN;
  const provided = req.nextUrl.searchParams.get("token") ?? "";
  if (!expected || expected.length < 16 || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 404 });
  }

  const single = req.nextUrl.searchParams.get("domain")?.toLowerCase().trim();
  if (single) {
    const start = Date.now();
    const result = await fetchFirstCertAt(single);
    return NextResponse.json({
      mode: "single",
      domain: single,
      first_cert_at: result?.toISOString() ?? null,
      ms: Date.now() - start,
    });
  }

  // Backfill: every sender domain without a positive CT hit yet.
  // Includes both truly-unqueried domains and prior misses whose
  // 30-day retry window has elapsed.
  const rows = (await sql`
    SELECT d.domain
    FROM domains d
    LEFT JOIN domain_reputation_cache c ON c.domain = d.domain
    WHERE c.domain IS NULL
       OR c.first_cert_at IS NULL
       OR c.cert_checked_at < NOW() - INTERVAL '30 days'
    ORDER BY d.first_seen DESC
    LIMIT ${MAX_PER_CALL}
  `) as unknown as { domain: string }[];

  const results: Array<{
    domain: string;
    first_cert_at: string | null;
    ms: number;
  }> = [];
  for (const { domain } of rows) {
    const start = Date.now();
    try {
      const d = await fetchFirstCertAt(domain);
      results.push({
        domain,
        first_cert_at: d?.toISOString() ?? null,
        ms: Date.now() - start,
      });
    } catch (err) {
      console.error("[warm-ct] failed", { domain, err });
      results.push({ domain, first_cert_at: null, ms: Date.now() - start });
    }
  }

  return NextResponse.json({
    mode: "backfill",
    scanned: rows.length,
    results,
  });
}
