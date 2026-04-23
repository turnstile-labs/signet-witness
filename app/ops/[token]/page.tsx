import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

// Internal ops dashboard. Reached via a secret URL: /ops/<STATS_TOKEN>.
// Not linked from anywhere. Not localised. No tracking.
//
// Design rule for this page, above all else: an operator who has
// never seen the dashboard before should understand every number
// and every label from a single read, without reference material.
// Plain English, full words, one number per cell, lots of vertical
// space, no decoration beyond what a status label needs.

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

// "2 days ago" / "3 weeks ago" / "today" — avoids raw timestamps in
// table cells where only the relative recency matters to an operator.
function formatAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Canonical state label for a registered sender. Exactly three
// possible outputs; the label is the full status in plain English.
// No coloured dot, no abbreviation — just text.
type StatusLabel = "Verified" | "On record" | "Pending";

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
  if ((row.verified_event_count ?? 0) > 0) return "On record";
  return "Pending";
}

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

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 font-mono text-sm text-txt bg-bg min-h-screen">
      <header className="pb-6 mb-10 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight mb-1">
          Witnessed — ops dashboard
        </h1>
        <p className="text-xs text-muted-2 tabular-nums">
          {now} · environment {env} · commit {commit}
          {stats.dbSize ? ` · database ${stats.dbSize}` : ""}
        </p>
      </header>

      <Section title="Last 24 hours">
        <StatTable
          rows={[
            { label: "Emails witnessed", value: stats.events24h },
            {
              label: "Emails rejected",
              value: stats.throttled24h,
              warn: stats.throttled24h > 0,
            },
          ]}
        />
      </Section>

      <Section title="Last 7 days">
        <StatTable
          rows={[
            { label: "Emails witnessed", value: stats.events7d },
            {
              label: "Emails rejected",
              value: stats.throttled7d,
              warn: stats.throttled7d > 0,
            },
            { label: "New domains registered", value: stats.newDomains7d },
          ]}
        />
      </Section>

      <Section title="All time">
        <StatTable
          rows={[
            { label: "Registered domains", value: stats.domains },
            { label: "Verified domains", value: stats.verifiedDomains },
            { label: "Total emails witnessed", value: stats.events },
            { label: "Domains on denylist", value: stats.denylistTotal },
          ]}
        />
      </Section>

      <Section title="Activity — last 30 days">
        <Chart data={stats.eventsByDay} days={30} />
        <ActivitySummary data={stats.eventsByDay} total={stats.events30d} />
      </Section>

      <Section title="Registered domains">
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Every domain we&apos;ve ever seen as a sender. Ordered by trust
          score. &ldquo;Verified&rdquo; meets our quality threshold (trust
          score of 65 or more plus at least three mutual counterparties).
          &ldquo;On record&rdquo; has accepted emails but hasn&apos;t reached
          verified yet. &ldquo;Pending&rdquo; has just registered.
        </p>
        {stats.topSenders.length === 0 ? (
          <Empty>No domains have been registered yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted-2 border-b border-border">
                <th className="py-2 pr-4 font-normal">Domain</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal text-right">Emails</th>
                <th className="py-2 pr-4 font-normal text-right">
                  Trust score
                </th>
                <th className="py-2 font-normal">First seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.topSenders.map((r) => {
                const status = statusFor(r);
                return (
                  <tr key={r.domain}>
                    <td className="py-3 pr-4 truncate max-w-[14rem]">
                      {r.domain}
                    </td>
                    <td
                      className={`py-3 pr-4 ${
                        status === "Verified"
                          ? "text-verified"
                          : status === "On record"
                            ? "text-accent"
                            : "text-muted"
                      }`}
                    >
                      {status}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {r.event_count.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {r.trust_index !== null ? `${r.trust_index} / 100` : "—"}
                    </td>
                    <td className="py-3 text-muted whitespace-nowrap">
                      {formatAge(r.first_seen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Top recipient domains">
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Domains that most frequently appear as recipients of witnessed
          emails. &ldquo;Registered&rdquo; means the recipient domain has also
          sealed at least one email of its own; &ldquo;Unclaimed&rdquo; means
          it only appears on the receiving end.
        </p>
        {stats.topReceivers.length === 0 ? (
          <Empty>No recipient data yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted-2 border-b border-border">
                <th className="py-2 pr-4 font-normal">Domain</th>
                <th className="py-2 pr-4 font-normal text-right">
                  Emails received
                </th>
                <th className="py-2 pr-4 font-normal text-right">
                  Distinct senders
                </th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.topReceivers.map((r) => (
                <tr key={r.receiver_domain}>
                  <td className="py-3 pr-4 truncate max-w-[14rem]">
                    {r.receiver_domain}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {r.count.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {r.distinct_senders.toLocaleString()}
                  </td>
                  <td className="py-3 text-muted">
                    {r.claimed ? "Registered" : "Unclaimed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Rejected emails — last 7 days">
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Emails that were received and cryptographically valid, but not
          added to any domain&apos;s public record. Usually because the
          sender exceeded a rate limit, the recipient&apos;s domain has no
          working mail server, or a reputation check failed. Kept for
          forensic review, never shown publicly.
        </p>
        {stats.throttled7d === 0 ? (
          <Empty>No emails have been rejected in the last 7 days.</Empty>
        ) : (
          <>
            <h3 className="text-xs uppercase tracking-wide text-muted-2 mb-2 mt-6">
              Grouped by reason
            </h3>
            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted-2 border-b border-border">
                  <th className="py-2 pr-4 font-normal">Reason</th>
                  <th className="py-2 font-normal text-right">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.throttledByReason.map((r) => (
                  <tr key={r.reason}>
                    <td className="py-3 pr-4">{describeReason(r.reason)}</td>
                    <td className="py-3 text-right tabular-nums">
                      {r.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {stats.throttledTopSenders.length > 0 && (
              <>
                <h3 className="text-xs uppercase tracking-wide text-muted-2 mb-2">
                  Top offending senders
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted-2 border-b border-border">
                      <th className="py-2 pr-4 font-normal">Sender domain</th>
                      <th className="py-2 font-normal text-right">Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.throttledTopSenders.map((s) => (
                      <tr key={s.sender_domain}>
                        <td className="py-3 pr-4 truncate max-w-[14rem]">
                          {s.sender_domain}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          {s.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Section>

      <Section title="Denylist">
        <p className="text-xs text-muted mb-4 leading-relaxed">
          Domains that have requested GDPR erasure or have opted out of
          being witnessed. Inbound emails that name these domains are
          silently dropped.
        </p>
        {stats.denylistTotal === 0 ? (
          <Empty>No domains are currently on the denylist.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted-2 border-b border-border">
                <th className="py-2 pr-4 font-normal">Reason</th>
                <th className="py-2 font-normal text-right">Domains</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.denylistByReason.map((r) => (
                <tr key={r.reason}>
                  <td className="py-3 pr-4">
                    {r.reason === "erasure"
                      ? "GDPR erasure (Article 17)"
                      : r.reason === "opt_out"
                        ? "Opt-out (Article 21)"
                        : r.reason}
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {r.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <footer className="mt-16 pt-6 border-t border-border">
        <p className="text-xs text-muted-2 leading-relaxed">
          Rotate STATS_TOKEN to revoke access to this page. Nothing here is
          cached — every load runs a fresh query against the production
          database.
        </p>
      </footer>
    </main>
  );
}

// ────────────────────────────────────────────────────────────
// Labels
// ────────────────────────────────────────────────────────────

// Anti-abuse reasons are short machine tokens in the database
// (`rate_limit`, `receiver_no_mx`, etc). Translate each to a human
// phrase at the render boundary so the table doesn't require a legend.
function describeReason(reason: string): string {
  switch (reason) {
    case "rate_limit":
      return "Sender exceeded the rate limit";
    case "receiver_no_mx":
      return "Recipient domain has no mail server";
    case "receiver_blocklist":
      return "Recipient domain is on a known-bad list";
    case "concentration":
      return "Sender is only emailing one recipient";
    default:
      return reason;
  }
}

// ────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-base font-bold mb-4 text-txt">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-2 py-2">{children}</p>;
}

// Label on the left, number on the right. Nothing else. Used for the
// top three summary sections (24h, 7d, all-time).
function StatTable({
  rows,
}: {
  rows: Array<{ label: string; value: number; warn?: boolean }>;
}) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-3 pr-4 text-muted">{r.label}</td>
            <td
              className={`py-3 text-right tabular-nums font-medium ${
                r.warn ? "text-amber" : "text-txt"
              }`}
            >
              {r.value.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// One-line summary under the 30-day chart: total, peak day, average.
// All three phrased as full English so the chart never needs a caption.
function ActivitySummary({
  data,
  total,
}: {
  data: Array<{ day: string; count: number }>;
  total: number;
}) {
  if (total === 0) {
    return (
      <p className="text-xs text-muted mt-3">
        No activity in the last 30 days.
      </p>
    );
  }
  const peak = Math.max(0, ...data.map((d) => d.count));
  const avg = Math.round(total / 30);
  return (
    <p className="text-xs text-muted mt-3 tabular-nums leading-relaxed">
      {total.toLocaleString()} email{total === 1 ? "" : "s"} over 30 days.
      Busiest day saw {peak.toLocaleString()}. Average of{" "}
      {avg.toLocaleString()} per day.
    </p>
  );
}

// 30 one-pixel-wide bars, one per day, left-to-right oldest-to-newest.
// Hover a bar for the exact count on that day. Kept simple — if the
// shape on the chart is interesting, follow up with a real tool.
function Chart({
  data,
  days,
}: {
  data: Array<{ day: string; count: number }>;
  days: number;
}) {
  const byDay = new Map(data.map((d) => [d.day, d.count]));
  const now = new Date();
  const buckets: Array<{ day: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div>
      <div className="flex items-end gap-[3px] h-32 border-b border-border pb-0.5">
        {buckets.map((b) => {
          const h =
            b.count === 0
              ? 1
              : Math.max(4, Math.round((b.count / max) * 120));
          return (
            <div
              key={b.day}
              title={`${b.day}: ${b.count} email${b.count === 1 ? "" : "s"}`}
              className={`flex-1 rounded-sm ${
                b.count === 0 ? "bg-border" : "bg-accent/70"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-2 tabular-nums">
        <span>{buckets[0]?.day ?? ""}</span>
        <span>{buckets[buckets.length - 1]?.day ?? ""}</span>
      </div>
    </div>
  );
}
