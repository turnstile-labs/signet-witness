import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";
import OpsThemeToggle from "./OpsThemeToggle";
import {
  ACTIVITY_WEIGHT,
  MUTUAL_WEIGHT,
  TENURE_WEIGHT,
  DIVERSITY_WEIGHT,
  ACTIVITY_CAP,
  MUTUAL_CAP,
  TENURE_CAP_DAYS,
  VERIFIED_INDEX,
  MIN_MUTUALS,
} from "@/lib/trust";

// Internal ops dashboard. Reached via a secret URL: /ops/<STATS_TOKEN>.
// Not linked from anywhere. Not localised. No tracking.
//
// Design rule for this page, above all else: a first-read operator
// should answer the three operator questions from the top of the
// viewport without scrolling:
//
//   1. Is the system alive?       (24h activity)
//   2. Is anything going wrong?   (rejections, trend vs avg)
//   3. Is the product growing?    (new domains, verified count)
//
// Everything below the fold is detail — tables and anti-abuse
// breakdowns. Nothing on the page is prose; everything is a label
// + a number, or a chart + a caption.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "ops",
  robots: { index: false, follow: false, nocache: true },
};

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

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function formatAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

type StatusLabel = "Verified" | "Building" | "Inactive";

function statusFor(row: {
  trust_index: number | null;
  mutual_counterparties: number | null;
  verified_event_count: number | null;
  grandfathered_verified: boolean;
}): StatusLabel {
  if (row.grandfathered_verified) return "Verified";
  if (
    (row.trust_index ?? 0) >= VERIFIED_INDEX &&
    (row.mutual_counterparties ?? 0) >= MIN_MUTUALS
  ) {
    return "Verified";
  }
  if ((row.verified_event_count ?? 0) > 0) return "Building";
  return "Inactive";
}

function humanReason(reason: string): string {
  switch (reason) {
    case "rate_limit":
      return "Sender rate limit exceeded";
    case "receiver_no_mx":
      return "Recipient has no mail server";
    case "receiver_blocklist":
      return "Recipient on a known-bad list";
    case "concentration":
      return "Sender only emails one recipient";
    case "solo_recipient":
      return "No counterparty in To/Cc";
    case "erasure":
      return "GDPR erasure (Art 17)";
    case "opt_out":
      return "Opt-out (Art 21)";
    default:
      return reason;
  }
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default async function OpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const expected = process.env.STATS_TOKEN;
  if (!expected || expected.length < 16 || !tokenMatches(token, expected)) {
    notFound();
  }

  let stats: OpsStats;
  try {
    stats = await getOpsStats();
  } catch (err) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16 font-mono text-sm">
        <h1 className="text-lg font-bold mb-3">Ops — error</h1>
        <pre className="text-red-400 whitespace-pre-wrap text-xs">
          {(err as Error).message}
        </pre>
      </main>
    );
  }

  const env = process.env.VERCEL_ENV ?? "dev";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";

  // Derived pulse numbers. We compare 24h against the 7d daily average
  // because that's the smallest window where "normal" is well-defined;
  // any shorter and day-of-week noise dominates.
  const avg7d = stats.events7d > 0 ? Math.round(stats.events7d / 7) : 0;
  const delta24hPct =
    avg7d > 0
      ? Math.round(((stats.events24h - avg7d) / avg7d) * 100)
      : null;

  // Peak & average over 30d — used in the activity panel.
  const peak30d = Math.max(0, ...stats.eventsByDay.map((d) => d.count));
  const avg30d =
    stats.events30d > 0 ? Math.round(stats.events30d / 30) : 0;

  // Verified share — denominator is every registered sender. Floor
  // to 1% if there's any verified at all so it doesn't disappear to
  // 0% on small populations.
  const verifiedPct =
    stats.domains > 0
      ? Math.max(
          stats.verifiedDomains > 0 ? 1 : 0,
          Math.round((stats.verifiedDomains / stats.domains) * 100),
        )
      : 0;

  // Rejection rate — share of inbound that anti-abuse blocked. The
  // absolute count alone doesn't say if the filter is calibrated;
  // the rate does. Null when there's no 7d traffic baseline.
  const inbound7d = stats.events7d + stats.throttled7d;
  const rejectionRatePct =
    inbound7d > 0
      ? Math.round((stats.throttled7d / inbound7d) * 1000) / 10
      : null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 font-mono text-sm text-txt bg-bg min-h-screen">
      {/* Header ·································· */}
      <header className="flex flex-wrap items-baseline justify-between gap-4 pb-4 mb-6 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Witnessed ops
          </h1>
          <p className="text-xs text-muted-2 mt-0.5">
            Live view. Fresh DB query on every load.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <p className="text-[0.65rem] text-muted-2 tabular-nums text-right leading-relaxed">
            {now}
            <br />
            {env} · {commit}
            {stats.dbSize ? ` · ${stats.dbSize}` : ""}
          </p>
          <OpsThemeToggle />
        </div>
      </header>

      {/* KPI strip — 4 tiles, one glance = full health read ·······
          Tiles answer the three operator questions:
            1. Alive?         Emails · 24h
            2. Going wrong?   Rejected · 7d
            3. Growing?       Verified · domains  +  New domains · 7d
          The previous "Emails · 7d" tile was redundant with the 24h
          tile (which already shows 7d avg as its hint), so it was
          replaced with the headline product metric — Verified. */}
      <section
        aria-label="pulse"
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
      >
        <Kpi
          label="Emails · 24h"
          value={stats.events24h.toLocaleString()}
          hint={
            delta24hPct !== null
              ? `${delta24hPct > 0 ? "+" : ""}${delta24hPct}% vs 7d avg`
              : avg7d > 0
                ? "—"
                : "no 7d baseline"
          }
          hintTone={
            delta24hPct === null
              ? "muted"
              : delta24hPct > 0
                ? "good"
                : delta24hPct < 0
                  ? "warn"
                  : "muted"
          }
        />
        <Kpi
          label="Verified · domains"
          value={stats.verifiedDomains.toLocaleString()}
          tone={stats.verifiedDomains > 0 ? "good" : "muted"}
          hint={
            stats.domains > 0
              ? `${verifiedPct}% of ${stats.domains.toLocaleString()} registered`
              : "no domains registered"
          }
          hintTone={stats.verifiedDomains > 0 ? "good" : "muted"}
        />
        <Kpi
          label="Rejected · 7d"
          value={stats.throttled7d.toLocaleString()}
          tone={stats.throttled7d > 0 ? "warn" : "muted"}
          hint={
            stats.throttled7d === 0
              ? "all clean"
              : rejectionRatePct !== null
                ? `${rejectionRatePct}% of 7d inbound`
                : `${stats.throttled24h.toLocaleString()} in last 24h`
          }
          hintTone={stats.throttled7d > 0 ? "warn" : "good"}
        />
        <Kpi
          label="New domains · 7d"
          value={`+${stats.newDomains7d}`}
          hint={
            stats.newDomains30d > 0
              ? `+${stats.newDomains30d} over 30d`
              : "—"
          }
        />
      </section>

      {/* Totals ribbon — less urgent scale numbers.
          Verified moved up to the KPI strip (it's the headline product
          metric, not a ribbon scale-stat). Mutual edges replaces it
          here so the strongest anti-fake signal is visible at the
          top-of-page glance. */}
      <section
        aria-label="scale"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 mb-3 rounded-md border border-border bg-surface/30 text-xs tabular-nums"
      >
        <Stat label="Registered domains" value={stats.domains} />
        <Stat
          label="Mutual edges"
          value={stats.mutualPairsTotal}
          accent={stats.mutualPairsTotal > 0 ? "verified" : undefined}
        />
        <Stat label="Total emails" value={stats.events} />
        <Stat
          label="Denylist"
          value={stats.denylistTotal}
          accent={stats.denylistTotal > 0 ? "warn" : undefined}
        />
      </section>

      {/* Trust funnel — population shape across every registered
          sender. The single number that answers "is the invite loop
          working?": Building grows first, then Verified follows.
          Inactive (zero DKIM-verified events) is an operator-only
          sub-bucket; public surfaces collapse it into Building. */}
      <TrustFunnel tiers={stats.senderTiers} total={stats.domains} />

      {/* Activity panel — chart + side stats ······················ */}
      <section className="grid md:grid-cols-[1fr_13rem] gap-6 mb-8 p-5 rounded-md border border-border bg-surface/30">
        <div className="min-w-0">
          <h2 className="text-xs uppercase tracking-widest text-muted-2 mb-4">
            Activity · last 30 days
          </h2>
          <Chart data={stats.eventsByDay} days={30} />
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6 justify-center">
          <InlineStat label="Total" value={stats.events30d.toLocaleString()} />
          <InlineStat
            label="Peak day"
            value={`${peak30d.toLocaleString()} emails`}
          />
          <InlineStat
            label="Daily average"
            value={`${avg30d.toLocaleString()} emails`}
          />
          <InlineStat
            label="Distinct recipients"
            value={stats.distinctReceivers.toLocaleString()}
          />
          {stats.unclaimedReceivers > 0 && (
            <InlineStat
              label="Unclaimed"
              value={stats.unclaimedReceivers.toLocaleString()}
              tone="muted"
            />
          )}
        </div>
      </section>

      {/* Registered domains panel — leaderboard with status mix.
          The "Top recipients" panel that used to live alongside this
          one was a network map, not health data; it answered none of
          the three operator questions framing this dashboard, so it
          was removed in favor of the single full-width domains table. */}
      <div className="mb-8">
        <Panel
          title="Registered domains"
          legend={
            <Legend
              items={[
                { color: "bg-verified", label: "Verified" },
                { color: "bg-amber", label: "Building" },
                { color: "bg-inactive", label: "Inactive" },
              ]}
            />
          }
        >
          <TrustFormula />
          {stats.topSenders.length === 0 ? (
            <Empty>No domains registered yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-widest text-muted-2 border-b border-border">
                  <th className="py-2 pr-3 font-normal">Domain</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal text-right">
                    Emails
                  </th>
                  <th className="py-2 pr-3 font-normal text-right">Index</th>
                  <th className="py-2 font-normal text-right">Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.topSenders.slice(0, 8).map((r) => {
                  const status = statusFor(r);
                  return (
                    <tr key={r.domain}>
                      <td className="py-2.5 pr-3 truncate max-w-[11rem]">
                        {r.domain}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {r.event_count.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                        {r.trust_index !== null ? r.trust_index : "—"}
                      </td>
                      <td className="py-2.5 text-right text-muted-2 tabular-nums whitespace-nowrap">
                        {formatAge(r.first_seen)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Mutual edges — full width, prominent placement.
          A mutual edge means domain A sealed to domain B AND B sealed
          back to A. Both sides are DKIM-signing senders that bothered
          to BCC us — the only network shape an attacker can't cheaply
          fake. After the archive-probe finding (mailing lists destroy
          DKIM body hashes for third parties), this is THE metric that
          distinguishes the product from any DKIM verifier. The first
          mutual edge is the first product-market-fit signal. */}
      <div className="mb-8">
        <Panel
          title="Mutual edges"
          legend={
            <span className="text-[0.6rem] text-muted-2 tabular-nums">
              {stats.mutualPairsTotal === 0
                ? "anti-fake signal"
                : `${stats.mutualPairsTotal.toLocaleString()} total`}
            </span>
          }
        >
          {stats.mutualPairsTotal === 0 ? (
            <Empty>
              No mutual edges yet — the first reciprocal seal between
              two registered senders is the first signal the invite
              loop is working.
            </Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-widest text-muted-2 border-b border-border">
                  <th className="py-2 pr-3 font-normal">Pair</th>
                  <th className="py-2 font-normal text-right">
                    Combined emails
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.mutualPairs.map((p) => (
                  <tr key={`${p.a}↔${p.b}`}>
                    <td className="py-2.5 pr-3 truncate max-w-[28rem]">
                      <span className="text-txt">{p.a}</span>
                      <span className="text-muted-2 mx-2">↔</span>
                      <span className="text-txt">{p.b}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.events.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Ops grid — anti-abuse + denylist side-by-side ············ */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Panel
          title="Anti-abuse"
          legend={
            <span className="text-[0.6rem] text-muted-2 tabular-nums">
              {rejectionRatePct !== null
                ? `${rejectionRatePct}% of 7d inbound`
                : "last 7 days"}
            </span>
          }
        >
          {stats.throttled7d === 0 ? (
            <Empty tone="good">
              No emails rejected in the last 7 days.
            </Empty>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-1">
                  By reason
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {stats.throttledByReason.map((r) => (
                      <tr key={r.reason}>
                        <td className="py-2 pr-3">{humanReason(r.reason)}</td>
                        <td className="py-2 text-right tabular-nums text-amber">
                          {r.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stats.throttledTopSenders.length > 0 && (
                <div>
                  <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-1">
                    Top offenders
                  </p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {stats.throttledTopSenders.map((s) => (
                        <tr key={s.sender_domain}>
                          <td className="py-2 pr-3 truncate max-w-[13rem]">
                            {s.sender_domain}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {s.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Denylist">
          {stats.denylistTotal === 0 ? (
            <Empty tone="good">No domains on the denylist.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-widest text-muted-2 border-b border-border">
                  <th className="py-2 pr-3 font-normal">Reason</th>
                  <th className="py-2 font-normal text-right">Domains</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.denylistByReason.map((r) => (
                  <tr key={r.reason}>
                    <td className="py-2 pr-3">{humanReason(r.reason)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <footer className="mt-12 pt-4 border-t border-border">
        <p className="text-[0.65rem] text-muted-2 leading-relaxed">
          Rotate <code className="text-muted">STATS_TOKEN</code> to revoke
          access · Fresh DB query per load · No caching
        </p>
      </footer>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────────

// KPI tile. Large number, tiny label, one-line hint with its own
// tone. Tiles are the top-of-page pulse read — everything else is
// detail-for-when-a-tile-looks-wrong.
function Kpi({
  label,
  value,
  hint,
  tone = "default",
  hintTone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "muted" | "warn" | "good";
  hintTone?: "muted" | "good" | "warn";
}) {
  const valueClass =
    tone === "warn"
      ? "text-amber"
      : tone === "good"
        ? "text-verified"
        : tone === "muted"
          ? "text-muted-2"
          : "text-txt";
  const hintClass =
    hintTone === "good"
      ? "text-verified"
      : hintTone === "warn"
        ? "text-amber"
        : "text-muted-2";
  return (
    <div className="rounded-md border border-border bg-surface/30 px-4 py-3.5">
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums mt-1.5 leading-none ${valueClass}`}
      >
        {value}
      </p>
      {hint && (
        <p className={`text-[0.65rem] mt-2 tabular-nums ${hintClass}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

// Inline label+value pair. Used on the totals ribbon where
// horizontal density is the point.
function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "verified" | "warn";
}) {
  const cls =
    accent === "verified"
      ? "text-verified"
      : accent === "warn"
        ? "text-amber"
        : "text-txt";
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-[0.6rem] uppercase tracking-widest text-muted-2">
        {label}
      </span>
      <span className={`font-semibold ${cls}`}>
        {value.toLocaleString()}
      </span>
    </span>
  );
}

// Stacked label+value. Used inside the activity-panel sidebar.
function InlineStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "muted";
}) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2">
        {label}
      </p>
      <p
        className={`text-base font-semibold tabular-nums mt-0.5 ${
          tone === "muted" ? "text-muted" : "text-txt"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Colored dot + status label. The one place on the page where color
// is load-bearing — the dot is scannable in the list at a glance.
function StatusBadge({ status }: { status: StatusLabel }) {
  const cls =
    status === "Verified"
      ? "bg-verified"
      : status === "Building"
        ? "bg-amber"
        : "bg-inactive";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`}
        aria-hidden="true"
      />
      <span className="text-muted">{status}</span>
    </span>
  );
}

// Section panel — consistent framing for the two-column grids below
// the KPI strip. Title bar has space for a legend on the right.
function Panel({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-surface/30 p-5 min-w-0">
      <header className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-border">
        <h2 className="text-xs uppercase tracking-widest text-muted-2">
          {title}
        </h2>
        {legend}
      </header>
      {children}
    </section>
  );
}

// Trust-index formula caption.
//
// Always visible above the Registered domains table. Operators looking
// at the "Trust" column want to know how it's computed without leaving
// the page; four lines of math is below the threshold where progressive
// disclosure earns its complexity. All numbers are imported from
// `lib/trust.ts` so the legend can never drift from the math the
// `domain_scores` table actually uses.
//
// Layout: the composite formula on top, the four sub-formulas in a
// monospace grid below, and the verified gate as a final line. Muted
// styling so it sits as reference rather than competing with the table.
function TrustFormula() {
  const w = (n: number) => n.toFixed(2);
  return (
    <div className="mb-4 px-3 py-2.5 rounded border border-border/70 bg-bg/40 text-[0.7rem] leading-relaxed text-muted">
      <p className="font-mono text-muted-2 mb-1.5">
        <span className="text-muted">trust_index</span> ={" "}
        {w(ACTIVITY_WEIGHT)}·activity + {w(MUTUAL_WEIGHT)}·mutual +{" "}
        {w(TENURE_WEIGHT)}·tenure + {w(DIVERSITY_WEIGHT)}·diversity
      </p>
      <dl className="font-mono grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 text-muted-2">
        <dt className="text-muted">activity</dt>
        <dd>log(1+events) / log(1+{ACTIVITY_CAP})</dd>
        <dt className="text-muted">mutual</dt>
        <dd>min(mutuals, {MUTUAL_CAP}) / {MUTUAL_CAP}</dd>
        <dt className="text-muted">tenure</dt>
        <dd>min(days, {TENURE_CAP_DAYS}) / {TENURE_CAP_DAYS}</dd>
        <dt className="text-muted">diversity</dt>
        <dd>1 − Gini(events per receiver)</dd>
      </dl>
      <p className="font-mono text-muted-2 mt-1.5">
        <span className="text-muted">verified gate</span>: index ≥{" "}
        {VERIFIED_INDEX} AND mutuals ≥ {MIN_MUTUALS} (or grandfathered)
      </p>
    </div>
  );
}

// Trust funnel — population shape across every registered sender.
// Compact horizontal stacked bar + counts + percentages. Single
// "is the invite loop working?" read in one glance.
//
// Order Verified → Building → Inactive so the bar reads left-to-right
// as "best to worst" health. Each segment carries its absolute count
// directly under the label so operators don't need to mental-math
// percentages back to numbers.
function TrustFunnel({
  tiers,
  total,
}: {
  tiers: { verified: number; building: number; inactive: number };
  total: number;
}) {
  const sum = tiers.verified + tiers.building + tiers.inactive;
  if (total === 0 || sum === 0) {
    return (
      <section
        aria-label="trust-funnel"
        className="px-4 py-3 mb-6 rounded-md border border-border bg-surface/30 text-xs text-muted-2"
      >
        No registered senders yet — funnel will populate once domains
        start sealing.
      </section>
    );
  }
  const pct = (n: number) =>
    sum === 0 ? 0 : Math.round((n / sum) * 1000) / 10;
  const segments: Array<{
    key: "verified" | "building" | "inactive";
    label: string;
    count: number;
    bg: string;
    fg: string;
  }> = [
    {
      key: "verified",
      label: "Verified",
      count: tiers.verified,
      bg: "bg-verified/80",
      fg: "text-verified",
    },
    {
      key: "building",
      label: "Building",
      count: tiers.building,
      bg: "bg-amber/80",
      fg: "text-amber",
    },
    {
      key: "inactive",
      label: "Inactive",
      count: tiers.inactive,
      bg: "bg-inactive/70",
      fg: "text-muted",
    },
  ];
  return (
    <section
      aria-label="trust-funnel"
      className="px-4 py-3 mb-6 rounded-md border border-border bg-surface/30"
    >
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[0.6rem] uppercase tracking-widest text-muted-2">
          Trust funnel
        </p>
        <p className="text-[0.6rem] text-muted-2 tabular-nums">
          {sum.toLocaleString()} senders
        </p>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-border mb-2.5">
        {segments.map((s) =>
          s.count === 0 ? null : (
            <div
              key={s.key}
              className={s.bg}
              style={{ width: `${pct(s.count)}%` }}
              title={`${s.label}: ${s.count.toLocaleString()} (${pct(s.count)}%)`}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-baseline gap-2">
            <span className="text-[0.6rem] uppercase tracking-widest text-muted-2">
              {s.label}
            </span>
            <span className={`font-semibold ${s.fg}`}>
              {s.count.toLocaleString()}
            </span>
            <span className="text-muted-2">
              {pct(s.count)}%
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Legend({
  items,
}: {
  items: Array<{ color: string; label: string }>;
}) {
  return (
    <span className="flex items-center gap-3 text-[0.6rem] text-muted-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${it.color}`}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </span>
  );
}

function Empty({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "good";
}) {
  return (
    <p
      className={`text-xs py-3 ${
        tone === "good" ? "text-verified" : "text-muted-2"
      }`}
    >
      {children}
    </p>
  );
}

// 30 single-pixel-wide bars. Hover a bar for the exact count.
// Taller than the previous version because the chart carries the
// activity-panel's visual weight on a dashboard.
function Chart({
  data,
  days,
}: {
  data: Array<{ day: string; count: number }>;
  days: number;
}) {
  const byDay = new Map(data.map((d) => [d.day, d.count]));
  const nowUtc = new Date();
  const buckets: Array<{ day: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowUtc);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div>
      <div className="flex items-end gap-[3px] h-28 border-b border-border pb-0.5">
        {buckets.map((b) => {
          const h =
            b.count === 0
              ? 1
              : Math.max(4, Math.round((b.count / max) * 108));
          return (
            <div
              key={b.day}
              title={`${b.day}: ${b.count} email${b.count === 1 ? "" : "s"}`}
              className={`flex-1 rounded-sm ${
                b.count === 0 ? "bg-border" : "bg-brand/70 hover:bg-brand"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[0.6rem] text-muted-2 tabular-nums">
        <span>{buckets[0]?.day ?? ""}</span>
        <span>{buckets[buckets.length - 1]?.day ?? ""}</span>
      </div>
    </div>
  );
}
