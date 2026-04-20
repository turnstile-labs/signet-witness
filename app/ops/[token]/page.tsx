import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

// Internal ops dashboard. Secret URL: /ops/<STATS_TOKEN>.
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
      <main className="max-w-2xl mx-auto px-6 py-16 font-mono text-sm">
        <h1 className="text-base font-bold mb-3">ops · error</h1>
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
    <main className="max-w-2xl mx-auto px-6 py-12 font-mono text-sm text-txt bg-bg min-h-screen">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 mb-8 border-b border-border">
        <h1 className="text-base font-bold">witnessed · ops</h1>
        <div className="text-[0.65rem] text-muted-2 text-right">
          {now} · {env} · {commit}
          {stats.dbSize && ` · ${stats.dbSize}`}
        </div>
      </div>

      {/* Headline — the four numbers that matter */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-10">
        <Num label="domains" value={stats.domains} />
        <Num label="events" value={stats.events} />
        <Num label="events · 24h" value={stats.events24h} accent />
        <Num label="verified" value={stats.verifiedDomains} />
      </div>

      {/* Chart */}
      <Chart data={stats.eventsByDay} days={30} />

      {/* Top senders */}
      <div className="mt-10">
        <p className="text-[0.65rem] uppercase tracking-widest text-muted-2 mb-3">
          top senders
        </p>
        {stats.topSenders.length === 0 ? (
          <p className="text-xs text-muted-2 py-4">no data yet</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {stats.topSenders.slice(0, 10).map((s) => (
              <li
                key={s.domain}
                className="flex justify-between items-baseline py-2"
              >
                <span className="truncate">{s.domain}</span>
                <span className="text-muted tabular-nums ml-4">
                  {s.event_count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quiet footer */}
      <p className="mt-12 pt-6 border-t border-border text-[0.6rem] text-muted-2 leading-relaxed">
        rotate STATS_TOKEN to revoke. no caching · fresh query per load.
        {stats.denylistTotal > 0 &&
          ` · ${stats.denylistTotal} domain${stats.denylistTotal === 1 ? "" : "s"} on denylist`}
      </p>
    </main>
  );
}

function Num({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tabular-nums leading-none ${
          accent ? "text-accent" : ""
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

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
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[0.65rem] uppercase tracking-widest text-muted-2">
          events · 30d
        </p>
        <p className="text-xs text-muted tabular-nums">{total.toLocaleString()}</p>
      </div>
      <div className="flex items-end gap-[3px] h-20">
        {buckets.map((b) => {
          const h = b.count === 0 ? 2 : Math.max(4, Math.round((b.count / max) * 80));
          return (
            <div
              key={b.day}
              title={`${b.day} · ${b.count}`}
              className={`flex-1 rounded-sm transition-colors ${
                b.count === 0
                  ? "bg-border"
                  : "bg-accent/70 hover:bg-accent"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[0.6rem] text-muted-2">
        <span>{buckets[0]?.day.slice(5) ?? ""}</span>
        <span>{buckets[buckets.length - 1]?.day.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}
