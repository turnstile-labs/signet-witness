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
  trustTierFromScore,
  VERIFIED_INDEX,
  MIN_MUTUALS,
  type TrustTier,
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

// Compact history formatter — mirrors the landing mock. Renders the
// duration shown under the "History" stat on the seal page.
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

// ── Trust state visuals ──────────────────────────────────────
//
// Canonical state taxonomy lives in `lib/scores.ts#trustTierFromScore`
// and returns one of `verified | building`. This file maps each tier
// to one Tailwind palette and one icon so every surface on the seal
// page (hero, landing replica) reads from the same definitions.
// `dim` is a third tone used only on the Unclaimed placeholder, where
// the state block reads as ghosted.
//
// Palette is traffic-light semantic:
//   verified  → green   / ✓ check    / "Verified"
//   building  → amber   / ● dot      / "Building"    (sealed mail
//                                                      exists, trust
//                                                      bar not yet
//                                                      reached — this
//                                                      tier absorbs
//                                                      what used to
//                                                      be "pending"
//                                                      so the public
//                                                      surface stays
//                                                      binary)
//   dim       → gray    / ○ hollow   / "—" (Unclaimed only)
//
// Labels and subtitles are i18n-driven. Icon and color choices are
// structural and constant across locales.

type StateTone = TrustTier | "dim";

const STATE_TONE_CLASSES: Record<StateTone, {
  frame: string;
  title: string;
  subtitle: string;
}> = {
  verified: {
    frame: "border-verified/40 bg-verified/10",
    title: "text-verified",
    subtitle: "text-muted",
  },
  building: {
    frame: "border-amber/40 bg-amber/10",
    title: "text-amber",
    subtitle: "text-muted",
  },
  dim: {
    frame: "border-border bg-surface/40",
    title: "text-muted-2",
    subtitle: "text-muted-2",
  },
};

function StateIcon({ tone }: { tone: StateTone }) {
  if (tone === "verified") {
    return (
      <span
        aria-hidden
        className="shrink-0 w-10 h-10 rounded-full bg-verified flex items-center justify-center"
      >
        <svg viewBox="0 0 16 16" className="w-5 h-5 text-bg" fill="none">
          <path
            d="M 4 8.5 L 7 11 L 12 5.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (tone === "building") {
    return (
      <span
        aria-hidden
        className="shrink-0 w-10 h-10 rounded-full bg-amber flex items-center justify-center"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-bg" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="shrink-0 w-10 h-10 rounded-full border-2 border-muted-2"
    />
  );
}

// Seal-page hero. Leads with the state (colored frame, labeled,
// one icon) — the verdict a citizen reader is looking for. The
// 0–100 number drops to the supporting line as technical detail.
// Same component is mirrored 1:1 on the landing mock and the
// Unclaimed placeholder (dim tone), so state visuals are defined
// once and can't drift between surfaces.
function StateBlock({
  tone,
  title,
  subtitle,
}: {
  tone: StateTone;
  title: string;
  subtitle: string;
}) {
  const c = STATE_TONE_CLASSES[tone];
  return (
    <div
      className={`mt-8 rounded-xl border ${c.frame} px-4 sm:px-5 py-4 sm:py-5`}
    >
      <div className="flex items-center gap-4">
        <StateIcon tone={tone} />
        <div className="min-w-0">
          <p className={`text-xl sm:text-2xl font-bold ${c.title}`}>{title}</p>
          <p className={`text-xs sm:text-sm mt-1 ${c.subtitle}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// Path-to-verified checklist. Replaces the earlier "+39 / +3" delta
// math, which made mutuals (a 3-step discrete threshold) look
// trivially small next to the index gap (a continuous 65-point
// composite). The two requirements are not commensurable, and the
// delta form forced them into a matching visual shape that misled
// the reader. The checklist form reads the same whether you're at
// 0-of-3 or 2-of-3 and makes the AND relationship explicit.
// Returns null when both requirements are met — verified domains
// don't see this section at all.
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
    indexItem: string;
    indexCurrent: string;
    mutualsItem: string;
    mutualsCurrent: string;
    explainer: string;
  };
}) {
  const indexMet = trustIndex >= indexThreshold;
  const mutualsMet = mutuals >= mutualsThreshold;
  if (indexMet && mutualsMet) return null;

  return (
    <section className="mt-10 rounded-lg border border-border bg-surface/50 px-4 py-4 sm:px-5 sm:py-5">
      <EyebrowLabel>{labels.eyebrow}</EyebrowLabel>
      <ul className="mt-3 space-y-2 text-sm">
        <ChecklistItem
          done={indexMet}
          label={labels.indexItem}
          current={labels.indexCurrent}
        />
        <ChecklistItem
          done={mutualsMet}
          label={labels.mutualsItem}
          current={labels.mutualsCurrent}
        />
      </ul>
      <p className="mt-3 text-[0.7rem] text-muted-2 leading-relaxed">
        {labels.explainer}
      </p>
    </section>
  );
}

function ChecklistItem({
  done,
  label,
  current,
}: {
  done: boolean;
  label: string;
  current: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-0.5 shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ${
          done ? "border-verified bg-verified/20" : "border-muted-2"
        }`}
      >
        {done && (
          <svg viewBox="0 0 10 10" className="w-3 h-3 text-verified" fill="none">
            <path
              d="M 2 5 L 4 7 L 8 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className={done ? "text-muted-2 line-through" : "text-txt"}>
        {label}
        <span className="ml-1.5 text-muted-2">— {current}</span>
      </span>
    </li>
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
  const tier = trustTierFromScore(score, verified);
  const recent30 = daily.reduce((sum, d) => sum + d.count, 0);
  const firstSeenLabel = formatFirstSeen(record.first_seen, locale);

  // Display fallbacks when the score row hasn't materialised yet (cold
  // start, or a rare refresh failure). The page still renders; the
  // secondary line below acknowledges that quality data is warming.
  const trustIndex = score?.trust_index ?? 0;
  const verifiedEvents = score?.verified_event_count ?? record.event_count;
  const mutuals = score?.mutual_counterparties ?? 0;
  const diversity = score?.diversity ?? 0;

  // State block copy — one label + one supporting line per tier.
  // Subtitle carries the 0–100 trust index as technical detail under
  // the headline verdict. The Building tier also names the target so
  // the reader sees where they're headed.
  const stateTitle = t(`state.${tier}Title`);
  const stateSubtitle = verified.isVerified
    ? t("state.subtitleVerified", { index: trustIndex })
    : t("state.subtitleBuilding", {
        index: trustIndex,
        threshold: VERIFIED_INDEX,
      });

  return (
    // The seal page is the public showcase of a domain — every share
    // link, badge click, and "check this domain" hand-off lands here.
    // Visually it belongs to the same family as the landing/setup/legal
    // surfaces, so it opts into the `.marketing` brand tint (purple
    // `--brand` remaps `--accent`) for full consistency. Trust-tier
    // colors (verified green, building amber) stay independent of
    // brand, so this swap never collides with state.
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section>
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>

          {/* Header — domain + permalink. State is carried by the
              StateBlock immediately below; no inline pill on claimed
              pages. NoRecordPill only lives on the Unclaimed page. */}
          <div className="mt-3">
            <h1 className="text-3xl sm:text-5xl font-bold text-txt tracking-tight break-all leading-[1.05]">
              {decoded}
            </h1>
            <p className="text-xs sm:text-sm text-muted-2 font-mono mt-2 break-all">
              witnessed.cc/b/{decoded}
            </p>
          </div>

          {/* The verdict — colored block, labeled state, icon. Reads
              at a glance. The 0–100 number drops to the subtitle as
              technical detail, where a curious reader still finds it
              but a casual one doesn't have to parse it. */}
          <StateBlock tone={tier} title={stateTitle} subtitle={stateSubtitle} />

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
                indexItem: t("pathIndexItem", { threshold: VERIFIED_INDEX }),
                indexCurrent: t("pathIndexCurrent", { current: trustIndex }),
                mutualsItem: t("pathMutualsItem", { threshold: MIN_MUTUALS }),
                mutualsCurrent: t("pathMutualsCurrent", { current: mutuals }),
                explainer: t("pathExplainer"),
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
            {t("firstSealedSince", { date: firstSeenLabel })}{" "}
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
    // Same `.marketing` opt-in as the claimed seal page — Unclaimed is
    // the most marketing-facing surface of all (it's what a stranger
    // sees the first time someone types a domain into the lookup).
    <div className="marketing flex flex-col min-h-screen bg-bg">
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

          <div className="opacity-70 select-none">
            <StateBlock
              tone="dim"
              title={t("state.unclaimedTitle")}
              subtitle={t("state.subtitleUnclaimed")}
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
