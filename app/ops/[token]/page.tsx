import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

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

type StatusLabel = "Verified" | "Building" | "Pending";

function statusFor(row: {
  trust_index: number | null;
  mutual_counterparties: number | null;
  verified_event_count: number | null;
  grandfathered_verified: boolean;
}): StatusLabel {
  if (row.grandfathered_verified) return "Verified";
  if (
    (row.trust_index ?? 0) >= 65 &&
    (row.mutual_counterparties ?? 0) >= 3
  ) {
    return "Verified";
  }
  if ((row.verified_event_count ?? 0) > 0) return "Building";
  return "Pending";
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
        <p className="text-[0.65rem] text-muted-2 tabular-nums text-right leading-relaxed">
          {now}
          <br />
          {env} · {commit}
          {stats.dbSize ? ` · ${stats.dbSize}` : ""}
        </p>
      </header>

      {/* KPI strip — 4 tiles, one glance = full health read ······· */}
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
          label="Emails · 7d"
          value={stats.events7d.toLocaleString()}
          hint={avg7d > 0 ? `${avg7d.toLocaleString()}/day avg` : "—"}
        />
        <Kpi
          label="Rejected · 7d"
          value={stats.throttled7d.toLocaleString()}
          tone={stats.throttled7d > 0 ? "warn" : "muted"}
          hint={
            stats.throttled7d === 0
              ? "all clean"
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

      {/* Totals ribbon — less urgent scale numbers ················ */}
      <section
        aria-label="scale"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 mb-6 rounded-md border border-border bg-surface/30 text-xs tabular-nums"
      >
        <Stat label="Registered domains" value={stats.domains} />
        <Stat
          label="Verified"
          value={stats.verifiedDomains}
          accent="verified"
        />
        <Stat label="Total emails" value={stats.events} />
        <Stat
          label="Denylist"
          value={stats.denylistTotal}
          accent={stats.denylistTotal > 0 ? "warn" : undefined}
        />
      </section>

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

      {/* Domains grid — two side-by-side panels ··················· */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Panel
          title="Registered domains"
          legend={
            <Legend
              items={[
                { color: "bg-verified", label: "Verified" },
                { color: "bg-amber", label: "Building" },
                { color: "bg-pending", label: "Pending" },
              ]}
            />
          }
        >
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
                  <th className="py-2 pr-3 font-normal text-right">Trust</th>
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

        <Panel
          title="Top recipients"
          legend={
            <span className="text-[0.6rem] text-muted-2">
              last 30 days
            </span>
          }
        >
          {stats.topReceivers.length === 0 ? (
            <Empty>No recipient data yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-widest text-muted-2 border-b border-border">
                  <th className="py-2 pr-3 font-normal">Domain</th>
                  <th className="py-2 pr-3 font-normal text-right">
                    Received
                  </th>
                  <th className="py-2 pr-3 font-normal text-right">
                    Senders
                  </th>
                  <th className="py-2 font-normal">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.topReceivers.slice(0, 8).map((r) => (
                  <tr key={r.receiver_domain}>
                    <td className="py-2.5 pr-3 truncate max-w-[11rem]">
                      {r.receiver_domain}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {r.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                      {r.distinct_senders.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-muted-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            r.claimed
                              ? "bg-txt"
                              : "border border-muted-2 bg-transparent"
                          }`}
                          aria-hidden="true"
                        />
                        {r.claimed ? "Registered" : "Unclaimed"}
                      </span>
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
            <span className="text-[0.6rem] text-muted-2">last 7 days</span>
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
  tone?: "default" | "muted" | "warn";
  hintTone?: "muted" | "good" | "warn";
}) {
  const valueClass =
    tone === "warn"
      ? "text-amber"
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
        : "bg-pending";
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
                b.count === 0 ? "bg-border" : "bg-accent/70 hover:bg-accent"
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
