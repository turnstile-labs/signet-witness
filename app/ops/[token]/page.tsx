import { notFound } from "next/navigation";
import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { getOpsStats, type OpsStats } from "@/lib/db";

// Internal ops dashboard. Secret URL: /ops/<STATS_TOKEN>.
// Not linked from anywhere. Not locale-aware. Temporary.
//
// Layout rhythm, top to bottom:
//   1. Pulse tiles  — six KPIs, one glance tells you the state of the box.
//   2. Activity     — 30-day events bar chart + totals footer.
//   3. Domains      — top senders (by trust) + top receivers side by side.
//   4. Anti-abuse   — always visible; when quiet, declares itself quiet.
//   5. Hygiene      — denylist breakdown + meta footer.

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
      <main className="max-w-3xl mx-auto px-6 py-16 font-mono text-sm">
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

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 font-mono text-sm text-txt bg-bg min-h-screen">
      {/* Identity + heartbeat. Right-aligned meta block is small but
          carries env + commit so a screenshot is self-describing. */}
      <header className="flex items-baseline justify-between pb-5 mb-8 border-b border-border">
        <h1 className="text-base font-bold tracking-tight">witnessed · ops</h1>
        <div className="text-[0.6rem] text-muted-2 text-right leading-relaxed tabular-nums">
          <div>{now}</div>
          <div>
            {env} · {commit}
            {stats.dbSize ? ` · ${stats.dbSize}` : ""}
          </div>
        </div>
      </header>

      {/* PULSE — six tiles, one look. Everything at-a-glance a sleepy
          on-call wants before reading prose. */}
      <SectionLabel>pulse</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-10">
        <Tile
          label="events · 24h"
          value={stats.events24h.toLocaleString()}
          hint={
            vs7dAvg !== null
              ? `${vs7dAvg > 0 ? "+" : ""}${vs7dAvg}% vs 7d avg`
              : undefined
          }
          hintTone={
            vs7dAvg === null
              ? "muted"
              : vs7dAvg > 0
                ? "good"
                : vs7dAvg < 0
                  ? "warn"
                  : "muted"
          }
          tone="accent"
        />
        <Tile
          label="events · 7d"
          value={stats.events7d.toLocaleString()}
          hint={avg7d > 0 ? `${avg7d.toLocaleString()}/day avg` : undefined}
        />
        <Tile
          label="new domains · 7d"
          value={`+${stats.newDomains7d}`}
          hint={
            stats.newDomains30d > 0
              ? `+${stats.newDomains30d} · 30d`
              : undefined
          }
          tone={stats.newDomains7d === 0 ? "muted" : "default"}
        />
        <Tile
          label="verified"
          value={stats.verifiedDomains.toLocaleString()}
          hint={
            stats.domains > 0
              ? `of ${stats.domains.toLocaleString()} registered`
              : undefined
          }
        />
        <Tile
          label="throttled · 24h"
          value={stats.throttled24h.toLocaleString()}
          hint={
            stats.throttled7d > 0
              ? `${stats.throttled7d.toLocaleString()} · 7d`
              : "7d clean"
          }
          tone={stats.throttled24h === 0 ? "muted" : "warn"}
        />
        <Tile
          label="denylist"
          value={stats.denylistTotal.toLocaleString()}
          hint={
            stats.denylistTotal > 0
              ? stats.denylistByReason
                  .map((r) => `${r.reason} ${r.count}`)
                  .join(" · ")
              : "empty"
          }
          tone={stats.denylistTotal === 0 ? "muted" : "default"}
        />
      </div>

      {/* ACTIVITY — the shape of the last 30 days. Hover a bar for the
          per-day count; the footer gives absolute totals so the chart's
          relative scale doesn't mislead. */}
      <Section label="activity · 30d">
        <Chart data={stats.eventsByDay} days={30} />
        <p className="mt-4 text-[0.7rem] text-muted tabular-nums">
          <span className="text-muted-2">window · </span>
          {stats.events30d.toLocaleString()} events ·{" "}
          {stats.distinctReceivers.toLocaleString()} distinct receiver
          {stats.distinctReceivers === 1 ? "" : "s"}
          {stats.unclaimedReceivers > 0 && (
            <>
              {" ("}
              <span className="text-muted-2">
                {stats.unclaimedReceivers.toLocaleString()} unclaimed
              </span>
              {")"}
            </>
          )}
        </p>
        <p className="mt-1 text-[0.7rem] text-muted-2 tabular-nums">
          <span className="text-muted-2">registry · </span>
          {stats.events.toLocaleString()} events lifetime ·{" "}
          {stats.domains.toLocaleString()} domain
          {stats.domains === 1 ? "" : "s"}
        </p>
      </Section>

      {/* DOMAINS — top of the leaderboard on both sides of the wire.
          Senders carry trust/mutuals/age inline; receivers are volume-only. */}
      <Section label="domains">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
          <SenderList rows={stats.topSenders.slice(0, 8)} />
          <TopList
            title="receivers · by volume"
            rows={stats.topReceivers.slice(0, 8).map((r) => ({
              label: r.receiver_domain,
              value: r.count,
            }))}
            emptyLabel="no receivers yet"
          />
        </div>
      </Section>

      {/* ANTI-ABUSE — always visible. On clean days it says so loudly;
          on active days, reason breakdown + the domains driving it. */}
      <Section label="anti-abuse · 7d">
        {stats.throttled7d === 0 ? (
          <p className="text-xs text-muted-2">
            quiet — 0 events throttled in the last 7 days.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-4 mb-3">
              <p className="text-3xl font-bold tabular-nums leading-none text-amber">
                {stats.throttled24h.toLocaleString()}
              </p>
              <div className="text-[0.65rem] uppercase tracking-widest text-muted-2">
                throttled · 24h
                <div className="mt-1 normal-case tracking-normal text-[0.7rem] text-muted">
                  {stats.throttled7d.toLocaleString()} over 7d
                </div>
              </div>
            </div>
            {stats.throttledByReason.length > 0 && (
              <div className="mb-5">
                <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-1.5">
                  by reason
                </p>
                <ul className="text-xs space-y-0.5">
                  {stats.throttledByReason.map((r) => (
                    <li
                      key={r.reason}
                      className="flex justify-between tabular-nums"
                    >
                      <span className="text-txt">{r.reason}</span>
                      <span className="text-muted">
                        {r.count.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
          </>
        )}
      </Section>

      {/* FOOTER — rotate affordance + what the page guarantees. Small,
          quiet, intentional. */}
      <div className="mt-14 pt-5 border-t border-border">
        <p className="text-[0.6rem] text-muted-2 leading-relaxed">
          rotate STATS_TOKEN to revoke · no caching · fresh query per load
        </p>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-3">
      {children}
    </p>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

// KPI tile. Three lines: label → value → one-line hint. `tone` colors
// the value; `hintTone` colors the hint independently (green delta
// against a default-tone value, for instance).
function Tile({
  label,
  value,
  hint,
  tone = "default",
  hintTone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "muted" | "accent" | "warn";
  hintTone?: "muted" | "good" | "warn";
}) {
  const valueClass =
    tone === "muted"
      ? "text-muted-2"
      : tone === "accent"
        ? "text-accent"
        : tone === "warn"
          ? "text-amber"
          : "text-txt";
  const hintClass =
    hintTone === "good"
      ? "text-verified"
      : hintTone === "warn"
        ? "text-amber"
        : "text-muted";
  return (
    <div className="rounded-md border border-border bg-surface/40 px-3.5 py-3">
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums mt-1 leading-none ${valueClass}`}
      >
        {value}
      </p>
      {hint && (
        <p className={`text-[0.65rem] mt-1.5 tabular-nums truncate ${hintClass}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

// Human-friendly "days since first_seen". 0-29d → "Nd", 30-364d → "Nmo",
// 365+d → "Ny". No fractional months; one token, always.
function formatAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const days = Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

// Senders list carries three inline tags after the event count:
//   · tNN   trust index (always when known)
//   · mNN   mutual counterparties (only when > 0 — zero is noisy)
//   · age   days/months/years since first seen (contextual tenure cue)
function SenderList({
  rows,
}: {
  rows: Array<{
    domain: string;
    event_count: number;
    first_seen: string;
    trust_index: number | null;
    mutual_counterparties: number | null;
  }>;
}) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-widest text-muted-2 mb-2">
        senders · by trust
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-2 py-2">no senders yet</p>
      ) : (
        <ul className="divide-y divide-border text-xs">
          {rows.map((r) => {
            const age = formatAge(r.first_seen);
            return (
              <li
                key={r.domain}
                className="flex justify-between items-baseline py-2 gap-3"
              >
                <span className="truncate text-txt">{r.domain}</span>
                <span className="shrink-0 flex items-baseline gap-2 tabular-nums">
                  <span className="text-muted">
                    {r.event_count.toLocaleString()}
                  </span>
                  {r.trust_index !== null && (
                    <span className="text-[0.7rem] text-accent">
                      t{r.trust_index}
                    </span>
                  )}
                  {r.mutual_counterparties !== null &&
                    r.mutual_counterparties > 0 && (
                      <span className="text-[0.7rem] text-muted">
                        m{r.mutual_counterparties}
                      </span>
                    )}
                  {age && (
                    <span className="text-[0.7rem] text-muted-2">{age}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
              className="flex justify-between items-baseline py-2 gap-3"
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
      <div className="flex items-end gap-[3px] h-24 border-b border-border pb-0.5">
        {buckets.map((b) => {
          // Zero-count days get a 1px baseline tick instead of a visible tile —
          // keeps the chart quiet and lets real activity breathe.
          const h =
            b.count === 0 ? 1 : Math.max(4, Math.round((b.count / max) * 92));
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
