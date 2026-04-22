import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

// Internal ops dashboard. Secret URL: /ops/<STATS_TOKEN>.
// Not linked from anywhere. Not locale-aware. Temporary.
// Editorial rhythm: each section has one focal point + quiet context.

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

  const avg7d = stats.events7d > 0 ? Math.round(stats.events7d / 7) : 0;
  const vs7dAvg =
    avg7d > 0 ? Math.round(((stats.events24h - avg7d) / avg7d) * 100) : null;

  // Compact registry meta. Shows only the parts that actually carry
  // signal at current scale; skips verified/unclaimed when they'd read
  // as zero noise. One line, one read.
  const registryBits: string[] = [
    `${stats.domains.toLocaleString()} domain${stats.domains === 1 ? "" : "s"}`,
  ];
  if (stats.verifiedDomains > 0) {
    registryBits.push(`${stats.verifiedDomains} verified`);
  }
  if (stats.newDomains7d > 0) {
    registryBits.push(`+${stats.newDomains7d} · 7d`);
  }
  if (stats.unclaimedReceivers > 0) {
    registryBits.push(
      `${stats.unclaimedReceivers} unclaimed receiver${
        stats.unclaimedReceivers === 1 ? "" : "s"
      }`,
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 font-mono text-sm text-txt bg-bg min-h-screen">
      {/* Identity + heartbeat */}
      <div className="flex items-baseline justify-between pb-5 mb-10 border-b border-border">
        <h1 className="text-base font-bold tracking-tight">witnessed · ops</h1>
        <div className="text-[0.6rem] text-muted-2 text-right leading-relaxed">
          <div>{now}</div>
          <div>
            {env} · {commit}
            {stats.dbSize ? ` · ${stats.dbSize}` : ""}
          </div>
        </div>
      </div>

      {/* ACTIVITY — the hero. one number, live. */}
      <Section label="activity">
        <div className="flex items-baseline gap-4 mb-1">
          <p className="text-5xl font-bold tabular-nums leading-none text-accent">
            {stats.events24h.toLocaleString()}
          </p>
          <div className="text-[0.65rem] uppercase tracking-widest text-muted-2">
            events · 24h
            {vs7dAvg !== null && (
              <div
                className={`mt-1 normal-case tracking-normal text-[0.7rem] ${
                  vs7dAvg > 0
                    ? "text-verified"
                    : vs7dAvg < 0
                      ? "text-muted"
                      : "text-muted-2"
                }`}
              >
                {vs7dAvg > 0 ? "+" : ""}
                {vs7dAvg}% vs 7d avg ({avg7d}/day)
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-6 text-xs text-muted tabular-nums mb-5">
          <span>
            <span className="text-txt">{stats.events7d.toLocaleString()}</span>{" "}
            · 7d
          </span>
          <span>
            <span className="text-txt">{stats.events30d.toLocaleString()}</span>{" "}
            · 30d
          </span>
          <span className="text-muted-2">
            {stats.events.toLocaleString()} total
          </span>
        </div>
        <Chart data={stats.eventsByDay} days={30} />

        {/* Registry meta — one line, skips zeros, sits quietly. */}
        <p className="mt-5 text-[0.7rem] text-muted tabular-nums">
          <span className="text-muted-2">registry · </span>
          {registryBits.join(" · ")}
        </p>
      </Section>

      {/* TOP LISTS — senders + receivers side by side */}
      <Section label="top domains">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <TopList
            title="senders"
            rows={stats.topSenders.slice(0, 8).map((s) => ({
              label: s.domain,
              value: s.event_count,
            }))}
            emptyLabel="no senders yet"
          />
          <TopList
            title="receivers"
            rows={stats.topReceivers.slice(0, 8).map((r) => ({
              label: r.receiver_domain,
              value: r.count,
            }))}
            emptyLabel="no receivers yet"
          />
        </div>
      </Section>

      {/* ANTI-ABUSE — only renders when there's something to see.
          Stays silent at zero so clean days don't add visual noise. */}
      {stats.throttled7d > 0 && (
        <Section label="anti-abuse">
          <div className="flex items-baseline gap-4 mb-3">
            <p className="text-3xl font-bold tabular-nums leading-none text-txt">
              {stats.throttled24h.toLocaleString()}
            </p>
            <div className="text-[0.65rem] uppercase tracking-widest text-muted-2">
              throttled · 24h
              <div className="mt-1 normal-case tracking-normal text-[0.7rem] text-muted">
                {stats.throttled7d.toLocaleString()} · 7d
              </div>
            </div>
          </div>
          {stats.throttledByReason.length > 0 && (
            <p className="text-[0.7rem] text-muted tabular-nums mb-4">
              <span className="text-muted-2">by reason · </span>
              {stats.throttledByReason
                .map((r) => `${r.reason} ${r.count}`)
                .join(" · ")}
            </p>
          )}
          {stats.throttledTopSenders.length > 0 && (
            <TopList
              title="review queue · 7d"
              rows={stats.throttledTopSenders.map((s) => ({
                label: s.sender_domain,
                value: s.count,
              }))}
              emptyLabel=""
            />
          )}
        </Section>
      )}

      {/* HYGIENE — denylist + quiet meta */}
      <div className="mt-12 pt-6 border-t border-border space-y-2">
        {stats.denylistTotal > 0 ? (
          <p className="text-[0.7rem] text-muted">
            <span className="text-muted-2">denylist · </span>
            {stats.denylistTotal} domain
            {stats.denylistTotal === 1 ? "" : "s"}
            {stats.denylistByReason.length > 0 && (
              <>
                {" · "}
                {stats.denylistByReason
                  .map((r) => `${r.reason} ${r.count}`)
                  .join(", ")}
              </>
            )}
          </p>
        ) : (
          <p className="text-[0.7rem] text-muted-2">denylist · empty</p>
        )}
        {stats.throttled7d === 0 && (
          <p className="text-[0.7rem] text-muted-2">anti-abuse · quiet</p>
        )}
        <p className="text-[0.6rem] text-muted-2 leading-relaxed">
          rotate STATS_TOKEN to revoke. no caching · fresh query per load.
        </p>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-3">
        {label}
      </p>
      {children}
    </section>
  );
}

function TopList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-2">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-2 py-2">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border text-xs">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex justify-between items-baseline py-1.5 gap-3"
            >
              <span className="truncate text-txt">{r.label}</span>
              <span className="text-muted tabular-nums shrink-0">
                {r.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
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

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20 border-b border-border pb-0.5">
        {buckets.map((b) => {
          // Zero-count days get a 1px baseline tick instead of a visible tile —
          // keeps the chart quiet and lets real activity breathe.
          const h =
            b.count === 0 ? 1 : Math.max(4, Math.round((b.count / max) * 76));
          return (
            <div
              key={b.day}
              title={`${b.day} · ${b.count}`}
              className={`flex-1 rounded-sm ${
                b.count === 0 ? "bg-border" : "bg-accent/70 hover:bg-accent"
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[0.6rem] text-muted-2 tabular-nums">
        <span>{buckets[0]?.day.slice(5) ?? ""}</span>
        <span>peak {max.toLocaleString()}/day</span>
        <span>{buckets[buckets.length - 1]?.day.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}
