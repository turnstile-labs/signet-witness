import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getDomain,
  getSealAggregates,
  getReceiverCount,
  getDailyActivity,
} from "@/lib/db";
import {
  getDomainScore,
  computeVerified,
  VERIFIED_INDEX,
  MIN_MUTUALS,
} from "@/lib/scores";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import Sparkline from "@/app/components/Sparkline";
import BadgeEmbed from "@/app/components/BadgeEmbed";
import CopyableEmail from "@/app/components/CopyableEmail";

interface Props {
  params: Promise<{ locale: string; domain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `${domain} — Witnessed`,
    description: `Proof of business for ${domain} — verified, public, and impossible to fake.`,
  };
}

// ── Formatters ────────────────────────────────────────────────
function daysActive(firstSeen: string): number {
  const ms = Date.now() - new Date(firstSeen).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Compact "on record" formatter — mirrors the landing mock.
function formatActiveHistory(days: number): string {
  if (days === 0) return "< 1 d";
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  const years = days / 365;
  return years >= 10 ? `${Math.round(years)} yr` : `${years.toFixed(1)} yr`;
}

// Locale-aware "Jan 2025" / "ene 2025" label for the first-seen date.
function formatFirstSeen(firstSeen: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(firstSeen));
}

// ── Small primitives ──────────────────────────────────────────
function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
      {children}
    </p>
  );
}

// The "No record yet" pill on the Unclaimed page. On claimed pages
// the trust-index hero carries state, so the pill would duplicate
// that signal. On the Unclaimed page the hero is a dimmed placeholder
// and this pill is the only thing separating "no record exists" from
// "a real record with a terrible score."
function NoRecordPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface text-muted text-xs font-semibold shrink-0 self-start">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-2 inline-block" />
      {label}
    </span>
  );
}

function Stat({
  value,
  label,
  sub,
  dim = false,
}: {
  value: string;
  label: string;
  sub: string;
  dim?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-3xl sm:text-4xl font-bold font-mono leading-none ${
          dim ? "text-muted-2" : "text-txt"
        }`}
      >
        {value}
      </p>
      <p className="text-xs sm:text-sm font-semibold text-txt mt-2">{label}</p>
      <p className="text-[0.65rem] sm:text-xs text-muted-2 mt-0.5 leading-tight">
        {sub}
      </p>
    </div>
  );
}

// Trust-index hero: big numeric, a quiet 0–100 bar with a tick at the
// verified threshold. Reads well without the number (bar shape) and
// without the bar (number alone). Editorial contract: one focal
// artifact, one quiet supporting line.
function TrustIndexHero({
  score,
  threshold,
  verified,
  label,
  scaleLabel,
  dim = false,
}: {
  score: number;
  threshold: number;
  verified: boolean;
  label: string;
  scaleLabel: string;
  dim?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const barColor = dim
    ? "bg-muted-2"
    : verified
      ? "bg-verified"
      : "bg-accent";
  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p
            className={`text-5xl sm:text-6xl font-bold font-mono leading-none tabular-nums ${
              dim ? "text-muted-2" : "text-txt"
            }`}
          >
            {score}
            <span className="text-2xl sm:text-3xl text-muted-2 ml-1">
              / 100
            </span>
          </p>
          <p className="text-xs sm:text-sm font-semibold text-txt mt-2">
            {label}
          </p>
        </div>
        <p className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-2 shrink-0">
          {scaleLabel}
        </p>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-surface border border-border overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
        {/* Verified-threshold tick */}
        <div
          className="absolute top-0 h-full w-px bg-verified/60"
          style={{ left: `${threshold}%` }}
        />
      </div>
    </div>
  );
}

// Path-to-verified callout. Shown only when the domain is on-record
// but has not yet cleared the Verified threshold. Prescribes the
// exact work remaining — either trust-index points, mutual
// counterparties, or both — and names the thing Verified actually
// requires so the reader doesn't have to infer it from the stats.
function PathToVerified({
  trustIndex,
  mutuals,
  indexThreshold,
  mutualsThreshold,
  labels,
}: {
  trustIndex: number;
  mutuals: number;
  indexThreshold: number;
  mutualsThreshold: number;
  labels: {
    eyebrow: string;
    indexGap: string;
    mutualsGap: string;
    explainer: string;
  };
}) {
  const indexGap = Math.max(0, indexThreshold - trustIndex);
  const mutualsGap = Math.max(0, mutualsThreshold - mutuals);
  if (indexGap === 0 && mutualsGap === 0) return null;

  return (
    <section className="mt-10 rounded-lg border border-border bg-surface/50 px-4 py-4 sm:px-5 sm:py-5">
      <EyebrowLabel>{labels.eyebrow}</EyebrowLabel>
      <ul className="mt-3 space-y-1.5 text-sm text-txt">
        {indexGap > 0 && (
          <li className="flex items-baseline gap-2">
            <span className="text-muted-2 font-mono text-[0.7rem] tabular-nums shrink-0">
              +{indexGap}
            </span>
            <span className="text-muted">{labels.indexGap}</span>
          </li>
        )}
        {mutualsGap > 0 && (
          <li className="flex items-baseline gap-2">
            <span className="text-muted-2 font-mono text-[0.7rem] tabular-nums shrink-0">
              +{mutualsGap}
            </span>
            <span className="text-muted">{labels.mutualsGap}</span>
          </li>
        )}
      </ul>
      <p className="mt-3 text-[0.7rem] text-muted-2 leading-relaxed">
        {labels.explainer}
      </p>
    </section>
  );
}

// ── Seal page ─────────────────────────────────────────────────
export default async function SealPage({ params }: Props) {
  const { locale, domain } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("seal");
  const decoded = decodeURIComponent(domain).toLowerCase().trim();

  const record = await getDomain(decoded);

  if (!record) {
    const receiverCount = await getReceiverCount(decoded);
    return <UnclaimedPage domain={decoded} receiverCount={receiverCount} />;
  }

  // Score, aggregates, and 30-day activity fetched in parallel. Score
  // is lazy-refreshed on stale/TTL-expired — a handful of SQL aggregates,
  // sub-50ms at current scale.
  const [score, { uniqueReceivers }, daily] = await Promise.all([
    getDomainScore(record.id, record.domain),
    getSealAggregates(record.id),
    getDailyActivity(record.id, 30),
  ]);

  const days = daysActive(record.first_seen);
  const verified = computeVerified(score, record.grandfathered_verified);
  const recent30 = daily.reduce((sum, d) => sum + d.count, 0);
  const firstSeenLabel = formatFirstSeen(record.first_seen, locale);

  // Display fallbacks when the score row hasn't materialised yet (cold
  // start, or a rare refresh failure). The page still renders; the
  // secondary line below acknowledges that quality data is warming.
  const trustIndex = score?.trust_index ?? 0;
  const verifiedEvents = score?.verified_event_count ?? record.event_count;
  const mutuals = score?.mutual_counterparties ?? 0;
  const diversity = score?.diversity ?? 0;

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section>
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>

          {/* Header — domain + permalink. No pill: the trust-index
              hero below carries state directly (bar past threshold =
              verified; PathToVerified callout frames on-record).
              NoRecordPill only appears on the Unclaimed page where
              the hero is a placeholder. */}
          <div className="mt-3">
            <h1 className="text-3xl sm:text-5xl font-bold text-txt tracking-tight break-all leading-[1.05]">
              {decoded}
            </h1>
            <p className="text-xs sm:text-sm text-muted-2 font-mono mt-2 break-all">
              witnessed.cc/b/{decoded}
            </p>
          </div>

          {/* Trust index — the headline signal. Quality-adjusted, 0–100.
              A filled bar shows where the domain sits relative to the
              verified threshold, so even without the number the reader
              gets a shape. */}
          <TrustIndexHero
            score={trustIndex}
            threshold={VERIFIED_INDEX}
            verified={verified.isVerified}
            label={t("trustIndexLabel")}
            scaleLabel={t("trustIndexScale")}
          />

          <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-10">
            <Stat
              value={verifiedEvents.toLocaleString()}
              label={t("statVerifiedEmails")}
              sub={t("statVerifiedEmailsSub")}
            />
            <Stat
              value={formatActiveHistory(days)}
              label={t("statActiveHistory")}
              sub={t("statActiveHistorySub")}
            />
            <Stat
              value={mutuals.toString()}
              label={t("statMutuals")}
              sub={t("statMutualsSub")}
            />
          </div>

          <p className="mt-6 text-[0.7rem] text-muted-2 leading-relaxed max-w-xl">
            {t("scoreBasis", {
              receivers: uniqueReceivers,
              diversity: (diversity * 100).toFixed(0),
            })}
          </p>

          {!verified.isVerified && (
            <PathToVerified
              trustIndex={trustIndex}
              mutuals={mutuals}
              indexThreshold={VERIFIED_INDEX}
              mutualsThreshold={MIN_MUTUALS}
              labels={{
                eyebrow: t("pathEyebrow"),
                indexGap: t("pathIndexGap", { threshold: VERIFIED_INDEX }),
                mutualsGap: t("pathMutualsGap"),
                explainer: t("pathExplainer", {
                  index: VERIFIED_INDEX,
                  mutuals: MIN_MUTUALS,
                }),
              }}
            />
          )}

          <p className="mt-10 text-sm text-muted leading-relaxed max-w-xl">
            {t("trustLine")}
          </p>
        </section>

        {/* ── Activity ─────────────────────────────────────────── */}
        <section className="mt-12 pt-10 border-t border-border">
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <EyebrowLabel>{t("activityEyebrow")}</EyebrowLabel>
            <p className="text-[0.65rem] text-muted-2 font-mono">
              {t("barLegend")}
            </p>
          </div>
          <Sparkline data={daily} days={30} height={56} />
          <p className="mt-5 text-sm text-muted leading-relaxed">
            {t("onRecordSince", { date: firstSeenLabel })}{" "}
            {t("activitySummary", { count: recent30 })}
          </p>
        </section>

        {/* ── Embeddable badge ────────────────────────────────────
             Third section follows the same editorial rhythm as hero
             and activity: noun eyebrow → artifact → one plain line of
             context. No action CTAs, no marketing headlines — the
             badge itself IS the content; the eyebrow just names it. */}
        <section className="mt-12 pt-10 border-t border-border">
          <EyebrowLabel>{t("badgeEyebrow")}</EyebrowLabel>
          <p className="mt-3 mb-6 text-sm text-muted leading-relaxed max-w-xl">
            {t("badgeIntro")}
          </p>
          <BadgeEmbed domain={decoded} />
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ── Unclaimed state ───────────────────────────────────────────
async function UnclaimedPage({
  domain,
  receiverCount,
}: {
  domain: string;
  receiverCount: number;
}) {
  const t = await getTranslations("seal");
  const tu = await getTranslations("seal.unclaimed");
  const hasReceiverActivity = receiverCount > 0;

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* ── Hero (dimmed) ────────────────────────────────────── */}
        <section>
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-5xl font-bold text-muted-2 tracking-tight break-all leading-[1.05] select-none">
                {domain}
              </h1>
              <p className="text-xs sm:text-sm text-muted-2 font-mono mt-2 break-all">
                witnessed.cc/b/{domain}
              </p>
            </div>
            <NoRecordPill label={t("noRecordPill")} />
          </div>

          <div className="opacity-60 select-none">
            <TrustIndexHero
              score={0}
              threshold={VERIFIED_INDEX}
              verified={false}
              label={t("trustIndexLabel")}
              scaleLabel={t("trustIndexScale")}
              dim
            />
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-10 opacity-60 select-none">
            <Stat
              value="—"
              label={t("statVerifiedEmails")}
              sub={t("statVerifiedEmailsSub")}
              dim
            />
            <Stat
              value="—"
              label={t("statActiveHistory")}
              sub={t("statActiveHistorySub")}
              dim
            />
            <Stat
              value="—"
              label={t("statMutuals")}
              sub={t("statMutualsSub")}
              dim
            />
          </div>

          <p className="mt-10 text-sm text-muted leading-relaxed max-w-xl">
            {hasReceiverActivity
              ? tu.rich("noOutboundBody", {
                  name: domain,
                  count: receiverCount,
                  d: (chunks) => (
                    <span className="font-mono text-txt break-all">
                      {chunks}
                    </span>
                  ),
                })
              : tu.rich("noRecordBody", {
                  name: domain,
                  addr: "seal@witnessed.cc",
                  d: (chunks) => (
                    <span className="font-mono text-txt break-all">
                      {chunks}
                    </span>
                  ),
                  e: (chunks) => (
                    <code className="font-mono text-accent text-[0.8rem]">
                      {chunks}
                    </code>
                  ),
                })}
          </p>
        </section>

        {/* ── Claim / Start record ─────────────────────────────────
             Visually matches the landing hero CTA: CopyableEmail hero
             button as the primary action, with the /setup pathway as
             the secondary accent link right below. Same button, same
             copy, same rhythm as the rest of the site — consistent
             visual language wherever someone is about to take action.
             Eyebrow shifts based on context — "Claim this page" when
             the domain is already being named in others' emails,
             "Start this record" when the page is cold. */}
        <section className="mt-12 pt-10 border-t border-border text-center">
          <EyebrowLabel>
            {hasReceiverActivity ? tu("claimEyebrow") : tu("startEyebrow")}
          </EyebrowLabel>

          <div className="mt-8">
            <CopyableEmail variant="hero" />
          </div>

          <p className="mt-5 text-xs text-muted-2">
            {tu("orAutoLabel")}{" "}
            <Link
              href="/setup"
              className="font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              {tu("orAutoLink")}
            </Link>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
