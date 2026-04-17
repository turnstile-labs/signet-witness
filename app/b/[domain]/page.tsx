import Link from "next/link";
import {
  getDomain,
  getEvents,
  getReceiverCount,
  getDailyActivity,
  type WitnessEvent,
} from "@/lib/db";
import type { Metadata } from "next";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import Sparkline from "@/app/components/Sparkline";
import CopyText from "@/app/components/CopyText";

interface Props {
  params: Promise<{ domain: string }>;
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

function formatDays(days: number): string {
  if (days === 0) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function domainInitials(domain: string): string {
  return domain.replace(/\.[^.]+$/, "").slice(0, 2).toUpperCase();
}

// ── Small primitives ──────────────────────────────────────────
function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
      {children}
    </p>
  );
}

function StatCard({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-2xl font-bold text-txt font-mono mb-0.5">{value}</p>
      <p className="text-xs text-txt font-medium mb-0.5">{label}</p>
      <p className="text-[0.65rem] text-muted-2">{sub}</p>
    </div>
  );
}

// ── Verified status ───────────────────────────────────────────
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

function VerifiedBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 bg-verified/10 border border-verified/25 text-verified text-xs font-semibold px-3 py-1.5 rounded-full font-mono shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
      ✦ Verified Active
    </div>
  );
}

function BuildingBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 bg-surface border border-border text-muted text-xs font-semibold px-3 py-1.5 rounded-full font-mono shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
      Building
    </div>
  );
}

function VerifiedPanel({
  days,
  eventCount,
}: {
  days: number;
  eventCount: number;
}) {
  const isVerified = days >= VERIFIED_DAYS && eventCount >= VERIFIED_EMAILS;

  if (isVerified) {
    return (
      <div className="bg-verified/5 border border-verified/20 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-verified text-lg leading-none mt-0.5">✦</span>
          <div>
            <p className="text-sm font-semibold text-verified mb-1">
              Verified Active Business
            </p>
            <p className="text-xs text-muted leading-relaxed">
              This domain has maintained consistent, cryptographically verified
              email activity for over 90 days across multiple real
              counterparties. This history cannot be fabricated, backdated, or
              edited.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const daysProgress = Math.min(100, Math.round((days / VERIFIED_DAYS) * 100));
  const emailsProgress = Math.min(
    100,
    Math.round((eventCount / VERIFIED_EMAILS) * 100)
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-txt">Building toward Verified</p>
        <span className="text-[0.65rem] text-muted-2 bg-bg border border-border px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">
          In progress
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        Verified status requires {VERIFIED_DAYS}+ days on record and at least{" "}
        {VERIFIED_EMAILS} verified emails. The longer and more consistent the
        history, the stronger the proof.
      </p>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5">
            <span>Days on record</span>
            <span>
              {formatDays(days)} / {VERIFIED_DAYS}
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
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5">
            <span>Verified emails</span>
            <span>
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

// ── Domain header (shared between sealed + unclaimed states) ──
function DomainHeader({
  domain,
  eyebrow,
  sub,
  right,
}: {
  domain: string;
  eyebrow: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-sm font-bold text-muted shrink-0">
          {domainInitials(domain)}
        </div>
        <div className="min-w-0">
          <EyebrowLabel>{eyebrow}</EyebrowLabel>
          <h1 className="text-xl sm:text-2xl font-bold text-txt tracking-tight font-mono leading-tight break-all mt-1">
            {domain}
          </h1>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── Seal page (claimed / has record) ──────────────────────────
export default async function SealPage({ params }: Props) {
  const { domain } = await params;
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
  const isVerified = days >= VERIFIED_DAYS && record.event_count >= VERIFIED_EMAILS;

  const sealUrl = `https://witnessed.cc/b/${decoded}`;
  const badgeSnippet = `<a href="${sealUrl}"><img src="https://witnessed.cc/badge/${decoded}.svg" alt="Verified on Witnessed" height="28" /></a>`;

  const recent30 = daily.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar variant="seal" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">

        <DomainHeader
          domain={decoded}
          eyebrow="Proof of business"
          sub={`On record since ${formatDate(record.first_seen)}`}
          right={isVerified ? <VerifiedBadge /> : <BuildingBadge />}
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            value={formatDays(days)}
            label="Days on record"
            sub="since first email"
          />
          <StatCard
            value={record.event_count.toString()}
            label="Verified emails"
            sub="independently confirmed"
          />
          <StatCard
            value={uniqueReceivers.toString()}
            label="Counterparties"
            sub="distinct businesses"
          />
        </div>

        {/* Verified progress */}
        <VerifiedPanel days={days} eventCount={record.event_count} />

        {/* 30-day activity sparkline */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyebrowLabel>Last 30 days</EyebrowLabel>
              <p className="text-sm font-semibold text-txt mt-1">
                {recent30}{" "}
                <span className="text-muted font-normal">
                  verified {recent30 === 1 ? "email" : "emails"}
                </span>
              </p>
            </div>
            <p className="text-[0.65rem] text-muted-2 font-mono">
              each bar = one day
            </p>
          </div>
          <Sparkline data={daily} days={30} height={40} />
        </div>

        {/* Plain-language explainer */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <EyebrowLabel>What this proves</EyebrowLabel>
          <div className="space-y-2.5 mt-3">
            {[
              `Every entry was independently verified at the moment of sending — not self-reported.`,
              "Timestamps are cryptographic. No entry can be backdated — this history only grows forward.",
              `${decoded} was actively doing business on these dates. Proof of operation, not a claim.`,
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
            <div className="flex items-center justify-between mb-3 px-1">
              <EyebrowLabel>Verified business activity</EyebrowLabel>
              <p className="text-[0.65rem] text-muted-2 font-mono">
                {events.length >= 20 ? `latest 20 of ${record.event_count}` : `${events.length} total`}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {events.slice(0, 20).map((event, i) => (
                <div
                  key={(event as WitnessEvent).id}
                  className={`flex items-center justify-between px-5 py-3 ${
                    i < Math.min(events.length, 20) - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="text-sm font-mono text-txt truncate">
                      {event.receiver_domain}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-2 shrink-0">
                    {formatDateShort(event.witnessed_at)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-2 mt-2 px-1">
              Each row is one independently verified email sent from{" "}
              {decoded} to that business.
            </p>
          </div>
        )}

        {/* Owner tools */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <EyebrowLabel>Own this domain?</EyebrowLabel>
          <p className="text-sm text-muted leading-relaxed mt-2 mb-5">
            Share your seal page or embed a verified badge on your site. Every
            link back strengthens the proof for your visitors.
          </p>

          <div className="space-y-4">
            <CopyText value={sealUrl} label="Share this seal page" />
            <CopyText
              value={badgeSnippet}
              label="Embed a verified badge"
              multiline
            />
          </div>
        </div>

        {/* Close-of-page CTA */}
        <div className="text-center pt-4 pb-2">
          <p className="text-xs text-muted-2 font-mono mb-1">
            Want one of these for your business?
          </p>
          <Link
            href="/"
            className="text-sm text-accent hover:text-accent-2 transition-colors"
          >
            How Witnessed works →
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}

// ── Unclaimed state ───────────────────────────────────────────
function UnclaimedPage({
  domain,
  receiverCount,
}: {
  domain: string;
  receiverCount: number;
}) {
  const hasReceiverActivity = receiverCount > 0;

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar variant="seal" />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">

        <DomainHeader domain={domain} eyebrow="Proof of business" />

        {/* Placeholder stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6 opacity-30 select-none">
          {["Days on record", "Verified emails", "Counterparties"].map((label) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-2xl font-bold text-txt font-mono mb-0.5">—</p>
              <p className="text-xs text-txt font-medium mb-0.5">{label}</p>
            </div>
          ))}
        </div>

        {hasReceiverActivity ? (
          <>
            <div className="bg-surface border border-border rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-txt">No outbound record yet</p>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">
                <span className="font-mono text-txt">{domain}</span> has been the recipient
                in{" "}
                <span className="font-semibold text-txt">{receiverCount}</span>{" "}
                witnessed {receiverCount === 1 ? "communication" : "communications"} — other
                businesses are already emailing this domain and CCing Witnessed. But{" "}
                <span className="font-mono text-txt">{domain}</span> hasn&apos;t started
                building its own outbound record yet.
              </p>
              <div className="bg-bg border border-border rounded-xl p-4">
                <p className="text-sm font-semibold text-txt mb-1">Own this domain?</p>
                <p className="text-xs text-muted leading-relaxed">
                  CC{" "}
                  <code className="font-mono text-accent text-[0.72rem]">sealed@witnessed.cc</code>{" "}
                  on your outgoing emails to start building your record.{" "}
                  <Link href="/" className="text-accent hover:text-accent-2 transition-colors">
                    How it works →
                  </Link>
                </p>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <EyebrowLabel>What recipient activity means</EyebrowLabel>
              <p className="text-sm text-muted leading-relaxed mt-3">
                When any business sends an email and CCs{" "}
                <code className="font-mono text-txt text-xs">sealed@witnessed.cc</code>,
                we record the recipient&apos;s domain too. This shows real
                companies are already doing business with{" "}
                <span className="font-mono text-txt">{domain}</span>.
              </p>
            </div>
          </>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-muted-2 shrink-0" />
              <p className="text-sm font-semibold text-txt">No record yet</p>
            </div>
            <p className="text-sm text-muted leading-relaxed mb-5">
              <span className="font-mono text-txt">{domain}</span>{" "}hasn&apos;t
              been witnessed yet. Once you CC{" "}
              <code className="font-mono text-accent text-[0.72rem]">sealed@witnessed.cc</code>{" "}
              on a business email, this page will show a verified history —
              automatically, with no account needed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              How it works →
            </Link>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
