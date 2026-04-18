import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getDomain,
  getEvents,
  getReceiverCount,
  getDailyActivity,
  type WitnessEvent,
} from "@/lib/db";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import Sparkline from "@/app/components/Sparkline";
import BadgeEmbed from "@/app/components/BadgeEmbed";

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

function formatDaysLong(days: number): string {
  if (days === 0) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// Compact "active history" formatter — mirrors the landing mock.
function formatActiveHistory(days: number): string {
  if (days === 0) return "< 1 d";
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  const years = days / 365;
  return years >= 10 ? `${Math.round(years)} yr` : `${years.toFixed(1)} yr`;
}

function formatDateShort(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function domainInitials(domain: string): string {
  return domain.replace(/\.[^.]+$/, "").slice(0, 2).toUpperCase();
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

function StatusPill({
  state,
  label,
}: {
  state: "verified" | "building" | "pending";
  label: string;
}) {
  if (state === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-verified/30 bg-verified/10 text-verified text-[0.7rem] sm:text-xs font-semibold shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
        {label}
      </span>
    );
  }
  if (state === "building") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-500 text-[0.7rem] sm:text-xs font-semibold shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-surface-2 text-muted text-[0.7rem] sm:text-xs font-semibold shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-2 inline-block" />
      {label}
    </span>
  );
}

function SealCard({
  domain,
  stats,
  state,
  pillLabel,
  disclaimerStrong,
  disclaimerRest,
}: {
  domain: string;
  stats: Array<{ value: string; label: string; sub: string }>;
  state: "verified" | "building" | "pending";
  pillLabel: string;
  disclaimerStrong: string;
  disclaimerRest: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface overflow-hidden mb-6">
      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-[0.7rem] sm:text-xs font-mono text-muted shrink-0">
            {domainInitials(domain)}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-txt truncate">
              {domain}
            </p>
            <p className="text-[0.7rem] sm:text-xs text-muted font-mono truncate">
              witnessed.cc/b/{domain}
            </p>
          </div>
        </div>
        <StatusPill state={state} label={pillLabel} />
      </header>

      {/* Stats grid */}
      <div className="px-2 sm:px-6 py-5 sm:py-6 grid grid-cols-3 gap-1 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center px-1">
            <p className="text-xl sm:text-2xl font-bold text-txt font-mono mb-0.5 leading-none">
              {s.value}
            </p>
            <p className="text-[0.7rem] sm:text-xs font-semibold text-txt mt-1">
              {s.label}
            </p>
            <p className="text-[0.6rem] sm:text-[0.65rem] text-muted-2 mt-0.5 leading-tight">
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Footer disclaimer */}
      <div className="border-t border-border px-4 sm:px-6 py-3">
        <p className="text-[0.7rem] sm:text-xs text-muted text-center leading-relaxed">
          <span className="text-accent font-semibold">{disclaimerStrong}</span>{" "}
          {disclaimerRest}
        </p>
      </div>
    </article>
  );
}

// ── Building progress ─────────────────────────────────────────
function BuildingProgress({
  days,
  eventCount,
  title,
  inProgress,
  body,
  daysLabel,
  emailsLabel,
}: {
  days: number;
  eventCount: number;
  title: string;
  inProgress: string;
  body: string;
  daysLabel: string;
  emailsLabel: string;
}) {
  const daysProgress = Math.min(100, Math.round((days / VERIFIED_DAYS) * 100));
  const emailsProgress = Math.min(
    100,
    Math.round((eventCount / VERIFIED_EMAILS) * 100)
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-sm font-semibold text-txt">{title}</p>
        <span className="text-[0.65rem] text-muted-2 bg-bg border border-border px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">
          {inProgress}
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">{body}</p>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5 gap-2">
            <span>{daysLabel}</span>
            <span className="shrink-0">
              {formatDaysLong(days)} / {VERIFIED_DAYS}
            </span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${daysProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5 gap-2">
            <span>{emailsLabel}</span>
            <span className="shrink-0">
              {eventCount} / {VERIFIED_EMAILS}
            </span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${emailsProgress}%` }}
            />
          </div>
        </div>
      </div>
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

  const [events, daily] = await Promise.all([
    getEvents(record.id),
    getDailyActivity(record.id, 30),
  ]);

  const days = daysActive(record.first_seen);
  const uniqueReceivers = new Set(events.map((e) => e.receiver_domain)).size;
  const isVerified =
    days >= VERIFIED_DAYS && record.event_count >= VERIFIED_EMAILS;
  const state = isVerified ? "verified" : "building";
  const recent30 = daily.reduce((sum, d) => sum + d.count, 0);

  const stats = [
    {
      value: record.event_count.toString(),
      label: t("statVerifiedEmails"),
      sub: t("statVerifiedEmailsSub"),
    },
    {
      value: formatActiveHistory(days),
      label: t("statActiveHistory"),
      sub: t("statActiveHistorySub"),
    },
    {
      value: uniqueReceivers.toString(),
      label: t("statCounterparties"),
      sub: t("statCounterpartiesSub"),
    },
  ];

  const pillLabel = isVerified ? t("verifiedActive") : t("building");

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full">

        <div className="mb-6 text-center sm:text-left">
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>
        </div>

        <SealCard
          domain={decoded}
          stats={stats}
          state={state}
          pillLabel={pillLabel}
          disclaimerStrong={t("disclaimerStrong")}
          disclaimerRest={t("disclaimerRest")}
        />

        {!isVerified && (
          <BuildingProgress
            days={days}
            eventCount={record.event_count}
            title={t("buildingTitle")}
            inProgress={t("buildingInProgress")}
            body={t("buildingBody", {
              days: VERIFIED_DAYS,
              emails: VERIFIED_EMAILS,
            })}
            daysLabel={t("daysOnRecord")}
            emailsLabel={t("verifiedEmails")}
          />
        )}

        {/* 30-day activity sparkline */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="min-w-0">
              <EyebrowLabel>{t("last30")}</EyebrowLabel>
              <p className="text-sm font-semibold text-txt mt-1">
                {recent30}{" "}
                <span className="text-muted font-normal">
                  {recent30 === 1
                    ? t("verifiedEmailsOne")
                    : t("verifiedEmailsMany")}
                </span>
              </p>
            </div>
            <p className="text-[0.6rem] sm:text-[0.65rem] text-muted-2 font-mono text-right shrink-0">
              {t("barLegend")}
            </p>
          </div>
          <Sparkline data={daily} days={30} height={40} />
        </div>

        {/* What this proves */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <EyebrowLabel>{t("whatThisProves")}</EyebrowLabel>
          <div className="space-y-2.5 mt-3">
            {[
              t("proof1"),
              t("proof2"),
              t("proof3", { domain: decoded }),
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-verified text-sm font-bold leading-tight mt-0.5 shrink-0">
                  ✓
                </span>
                <p className="text-sm text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        {events.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1 gap-3">
              <EyebrowLabel>{t("activity")}</EyebrowLabel>
              <p className="text-[0.6rem] sm:text-[0.65rem] text-muted-2 font-mono text-right shrink-0">
                {events.length >= 20
                  ? t("latestOfTotal", { total: record.event_count })
                  : t("ofTotal", { count: events.length })}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div
                className={
                  events.length > 7
                    ? "max-h-[21rem] overflow-y-auto"
                    : ""
                }
              >
                {events.slice(0, 20).map((event, i) => (
                  <div
                    key={(event as WitnessEvent).id}
                    className={`flex items-center justify-between px-4 sm:px-5 py-3 gap-3 ${
                      i < Math.min(events.length, 20) - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      <span className="text-xs sm:text-sm font-mono text-txt truncate">
                        {event.receiver_domain}
                      </span>
                    </div>
                    <span className="text-[0.7rem] sm:text-xs font-mono text-muted-2 shrink-0">
                      {formatDateShort(event.witnessed_at, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-2 mt-2 px-1">
              {t.rich("rowFootnote", {
                name: decoded,
                d: (chunks) => (
                  <span className="font-mono break-all">{chunks}</span>
                ),
              })}
            </p>
          </div>
        )}

        {/* Owner tools */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <EyebrowLabel>{t("ownThisDomain")}</EyebrowLabel>
          <p className="text-sm text-muted leading-relaxed mt-2 mb-5">
            {t("ownThisDomainBody")}
          </p>
          <BadgeEmbed domain={decoded} />
        </div>

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

  const stats = [
    { value: "—", label: t("statVerifiedEmails"), sub: "—" },
    { value: "—", label: t("statActiveHistory"), sub: "—" },
    { value: "—", label: t("statCounterparties"), sub: "—" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full">

        <div className="mb-6 text-center sm:text-left">
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>
        </div>

        <div className="mb-6 opacity-60 select-none">
          <SealCard
            domain={domain}
            stats={stats}
            state="pending"
            pillLabel={t("pending")}
            disclaimerStrong={t("disclaimerStrong")}
            disclaimerRest={t("disclaimerRest")}
          />
        </div>

        {hasReceiverActivity ? (
          <>
            <div className="bg-surface border border-border rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-txt">
                  {tu("noOutbound")}
                </p>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">
                {tu.rich("noOutboundBody", {
                  name: domain,
                  count: receiverCount,
                  d: (chunks) => (
                    <span className="font-mono text-txt break-all">{chunks}</span>
                  ),
                })}
              </p>
              <div className="bg-bg border border-border rounded-xl p-4">
                <p className="text-sm font-semibold text-txt mb-1">
                  {tu("ownQ")}
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  {tu.rich("ownBody", {
                    addr: "sealed@witnessed.cc",
                    e: (chunks) => (
                      <code className="font-mono text-accent text-[0.72rem]">
                        {chunks}
                      </code>
                    ),
                  })}{" "}
                  <Link
                    href="/"
                    className="text-accent hover:text-accent-2 transition-colors"
                  >
                    {tu("howItWorks")}
                  </Link>
                </p>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <EyebrowLabel>{tu("recipientMeans")}</EyebrowLabel>
              <p className="text-sm text-muted leading-relaxed mt-3">
                {tu.rich("recipientBody", {
                  addr: "sealed@witnessed.cc",
                  name: domain,
                  e: (chunks) => (
                    <code className="font-mono text-txt text-xs">
                      {chunks}
                    </code>
                  ),
                  d: (chunks) => (
                    <span className="font-mono text-txt break-all">{chunks}</span>
                  ),
                })}
              </p>
            </div>
          </>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-muted-2 shrink-0" />
              <p className="text-sm font-semibold text-txt">{tu("noRecord")}</p>
            </div>
            <p className="text-sm text-muted leading-relaxed mb-5">
              {tu.rich("noRecordBody", {
                name: domain,
                addr: "sealed@witnessed.cc",
                d: (chunks) => (
                  <span className="font-mono text-txt break-all">{chunks}</span>
                ),
                e: (chunks) => (
                  <code className="font-mono text-accent text-[0.72rem]">
                    {chunks}
                  </code>
                ),
              })}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              {tu("howItWorks")}
            </Link>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
