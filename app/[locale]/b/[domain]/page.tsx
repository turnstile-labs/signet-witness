import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getDomain,
  getSealAggregates,
  getReceiverCount,
  getDailyActivity,
} from "@/lib/db";
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

// ── Constants ─────────────────────────────────────────────────
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// ── Small primitives ──────────────────────────────────────────
function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
      {children}
    </p>
  );
}

type PillState = "verified" | "building" | "pending";

function StatusPill({ state, label }: { state: PillState; label: string }) {
  if (state === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-verified/30 bg-verified/10 text-verified text-xs font-semibold shrink-0 self-start">
        <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
        {label}
      </span>
    );
  }
  if (state === "building") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-500 text-xs font-semibold shrink-0 self-start">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
        {label}
      </span>
    );
  }
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

  const [{ uniqueReceivers }, daily] = await Promise.all([
    getSealAggregates(record.id),
    getDailyActivity(record.id, 30),
  ]);

  const days = daysActive(record.first_seen);
  const isVerified =
    days >= VERIFIED_DAYS && record.event_count >= VERIFIED_EMAILS;
  const state: PillState = isVerified ? "verified" : "building";
  const recent30 = daily.reduce((sum, d) => sum + d.count, 0);
  const pillLabel = isVerified ? t("verifiedActive") : t("building");
  const firstSeenLabel = formatFirstSeen(record.first_seen, locale);

  // Context-aware one-liner shown under the trust line when the
  // domain hasn't yet cleared the Verified Active thresholds. The
  // previous dashboard-style bars duplicated hero stats and gamified
  // a wait that isn't actionable for the owner.
  const daysRemaining = Math.max(0, VERIFIED_DAYS - days);
  const emailsRemaining = Math.max(0, VERIFIED_EMAILS - record.event_count);
  let buildingHint: string | null = null;
  if (!isVerified) {
    if (daysRemaining > 0 && emailsRemaining > 0) {
      buildingHint = t("buildingHintBoth", {
        days: daysRemaining,
        count: emailsRemaining,
      });
    } else if (daysRemaining > 0) {
      buildingHint = t("buildingHintDays", { days: daysRemaining });
    } else if (emailsRemaining > 0) {
      buildingHint = t("buildingHintEmails", { count: emailsRemaining });
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section>
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-5xl font-bold text-txt tracking-tight break-all leading-[1.05]">
                {decoded}
              </h1>
              <p className="text-xs sm:text-sm text-muted-2 font-mono mt-2 break-all">
                witnessed.cc/b/{decoded}
              </p>
            </div>
            <StatusPill state={state} label={pillLabel} />
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-10">
            <Stat
              value={record.event_count.toString()}
              label={t("statVerifiedEmails")}
              sub={t("statVerifiedEmailsSub")}
            />
            <Stat
              value={formatActiveHistory(days)}
              label={t("statActiveHistory")}
              sub={t("statActiveHistorySub")}
            />
            <Stat
              value={uniqueReceivers.toString()}
              label={t("statCounterparties")}
              sub={t("statCounterpartiesSub")}
            />
          </div>

          <p className="mt-10 text-sm text-muted leading-relaxed max-w-xl">
            {t("trustLine")}
          </p>

          {buildingHint && (
            <p className="mt-4 text-xs text-muted-2 leading-relaxed max-w-xl">
              {buildingHint}
            </p>
          )}
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

        {/* ── Share this proof ─────────────────────────────────── */}
        <section className="mt-12 pt-10 border-t border-border">
          <EyebrowLabel>{t("shareEyebrow")}</EyebrowLabel>
          <h2 className="text-xl sm:text-2xl font-bold text-txt mt-3 mb-3 max-w-lg leading-tight">
            {t("shareTitle")}
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-6 max-w-lg">
            {t("shareSub")}
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
            <StatusPill state="pending" label={t("noRecordPill")} />
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
              label={t("statCounterparties")}
              sub={t("statCounterpartiesSub")}
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

        {/* ── Start this record ────────────────────────────────── */}
        <section className="mt-12 pt-10 border-t border-border">
          <EyebrowLabel>{tu("startEyebrow")}</EyebrowLabel>
          <p className="text-sm text-muted leading-relaxed mt-2 mb-6 max-w-lg">
            {tu("startBody")}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <CopyableEmail variant="compact" />
            <Link
              href="/"
              className="text-xs font-semibold text-accent hover:text-accent-2 transition-colors whitespace-nowrap"
            >
              {tu("howItWorks")}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
