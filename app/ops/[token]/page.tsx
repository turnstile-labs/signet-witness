import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

// Internal ops dashboard. Secret URL: /ops/<STATS_TOKEN>.
// If STATS_TOKEN is unset or the token doesn't match, we 404.
// Not linked from anywhere. Not locale-aware. Temporary.

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
      <main className="max-w-5xl mx-auto px-6 py-10 font-mono text-sm">
        <h1 className="text-xl font-bold mb-4">ops · error</h1>
        <pre className="text-red-400 whitespace-pre-wrap">
          {(err as Error).message}
        </pre>
      </main>
    );
  }

  const now = new Date().toISOString();
  const region = process.env.VERCEL_REGION ?? "local";
  const env = process.env.VERCEL_ENV ?? "development";
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 font-mono text-sm text-txt bg-bg min-h-screen">
      <header className="mb-8 pb-4 border-b border-border flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">witnessed · ops</h1>
          <p className="text-xs text-muted-2 mt-1">
            internal · do not share · temporary
          </p>
        </div>
        <div className="text-[0.7rem] text-muted-2 text-right leading-relaxed">
          <div>{now}</div>
          <div>
            {env} · {region} · {commit}
          </div>
          {stats.dbSize && <div>db: {stats.dbSize}</div>}
        </div>
      </header>

      {/* Headline counters */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Tile label="domains" value={stats.domains} />
        <Tile label="events" value={stats.events} />
        <Tile label="verified" value={stats.verifiedDomains} />
        <Tile label="denylist" value={stats.denylistTotal} />
        <Tile label="events / 24h" value={stats.events24h} accent />
        <Tile label="events / 7d" value={stats.events7d} />
        <Tile label="events / 30d" value={stats.events30d} />
        <Tile label="distinct rcvrs" value={stats.distinctReceivers} />
        <Tile label="unclaimed rcvrs" value={stats.unclaimedReceivers} />
        <Tile label="new doms / 7d" value={stats.newDomains7d} />
        <Tile label="new doms / 30d" value={stats.newDomains30d} />
        <Tile
          label="verify rate"
          value={
            stats.domains > 0
              ? Math.round((stats.verifiedDomains / stats.domains) * 100)
              : 0
          }
          suffix="%"
        />
      </section>

      {/* Daily charts */}
      <section className="grid md:grid-cols-2 gap-4 mb-8">
        <Chart
          title="events per day (30d)"
          data={stats.eventsByDay}
          days={30}
        />
        <Chart
          title="new domains per day (30d)"
          data={stats.newDomainsByDay}
          days={30}
        />
      </section>

      {/* Tables */}
      <section className="grid md:grid-cols-2 gap-4 mb-8">
        <Table
          title="top senders"
          rows={stats.topSenders.map((s) => [
            s.domain,
            s.event_count.toString(),
            new Date(s.first_seen).toISOString().slice(0, 10),
          ])}
          headers={["domain", "events", "first_seen"]}
        />
        <Table
          title="top receivers"
          rows={stats.topReceivers.map((r) => [
            r.receiver_domain,
            r.count.toString(),
            "",
          ])}
          headers={["receiver", "count", ""]}
        />
      </section>

      {/* Denylist breakdown */}
      {stats.denylistTotal > 0 && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-muted-2 mb-3">
            denylist by reason
          </h2>
          <ul className="text-xs space-y-1">
            {stats.denylistByReason.map((r) => (
              <li
                key={r.reason}
                className="flex justify-between border-b border-border py-1.5"
              >
                <span>{r.reason}</span>
                <span className="text-muted">{r.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="pt-6 mt-8 border-t border-border text-[0.65rem] text-muted-2">
        <p>
          rotate STATS_TOKEN in vercel env to revoke this url. nothing is
          cached; every load is a fresh query.
        </p>
      </footer>
    </main>
  );
}

function Tile({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-surface"
      }`}
    >
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-none">
        {value.toLocaleString()}
        {suffix && (
          <span className="text-muted text-base ml-0.5">{suffix}</span>
        )}
      </p>
    </div>
  );
}

function Table({
  title,
  rows,
  headers,
}: {
  title: string;
  rows: string[][];
  headers: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-[0.6rem] uppercase tracking-widest text-muted-2">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[0.6rem] uppercase tracking-widest text-muted-2">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-1.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-3 text-center text-muted-2"
              >
                empty
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-border hover:bg-bg/50 transition-colors"
              >
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1.5 truncate max-w-[220px]">
                    {c || <span className="text-muted-2">—</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Chart({
  title,
  data,
  days,
}: {
  title: string;
  data: Array<{ day: string; count: number }>;
  days: number;
}) {
  // Fill in missing days so the chart width is consistent.
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
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[0.6rem] uppercase tracking-widest text-muted-2">
          {title}
        </p>
        <p className="text-xs text-muted">{total.toLocaleString()}</p>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {buckets.map((b) => {
          const h = Math.max(2, Math.round((b.count / max) * 60));
          return (
            <div
              key={b.day}
              title={`${b.day}: ${b.count}`}
              className="flex-1 bg-accent/70 hover:bg-accent rounded-sm transition-colors"
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[0.6rem] text-muted-2">
        <span>{buckets[0]?.day ?? ""}</span>
        <span>{buckets[buckets.length - 1]?.day ?? ""}</span>
      </div>
    </div>
  );
}
