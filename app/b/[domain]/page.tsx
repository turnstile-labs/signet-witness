import { notFound } from "next/navigation";
import { getDomain, getEvents, getReceiverCount, type WitnessEvent } from "@/lib/db";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `${domain} — Signet Witness`,
    description: `Verified communication history for ${domain}.`,
  };
}

function daysActive(firstSeen: string): number {
  const ms = Date.now() - new Date(firstSeen).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
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
    year: "numeric",
  });
}

function VerifiedStatus({ days, eventCount }: { days: number; eventCount: number }) {
  const daysNeeded = 90;
  const emailsNeeded = 10;
  const isVerified = days >= daysNeeded && eventCount >= emailsNeeded;
  const daysProgress = Math.min(100, Math.round((days / daysNeeded) * 100));
  const emailsProgress = Math.min(100, Math.round((eventCount / emailsNeeded) * 100));

  if (isVerified) {
    return (
      <div className="bg-verified/5 border border-verified/20 rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-verified text-base">✦</span>
          <p className="text-sm font-semibold text-verified">Verified</p>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          This domain has maintained consistent, DKIM-verified email communication
          for over 90 days with multiple distinct counterparties. This history is
          independently verifiable and cannot be fabricated or backdated.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-txt">Building toward Verified</p>
        <span className="font-mono text-[0.65rem] text-muted-2 bg-bg border border-border px-2 py-0.5 rounded-full uppercase tracking-widest">
          In progress
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-5">
        Verified status is earned after 90 days of consistent CC activity with at
        least 10 witnessed emails. Every CC strengthens the record — the history
        is what makes it credible.
      </p>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5">
            <span>Days active</span>
            <span>{days} / 90</span>
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
            <span>Witnessed emails</span>
            <span>{eventCount} / 10</span>
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

export default async function SealPage({ params }: Props) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain).toLowerCase().trim();

  const record = await getDomain(decoded);

  if (!record) {
    const receiverCount = await getReceiverCount(decoded);
    return <UnclaimedPage domain={decoded} receiverCount={receiverCount} />;
  }

  const events = await getEvents(record.id);
  const days = daysActive(record.first_seen);
  const uniqueReceivers = new Set(events.map((e) => e.receiver_domain)).size;

  return (
    <main className="flex flex-col min-h-screen bg-bg">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight text-txt hover:opacity-80 transition-opacity">
            Signet <span className="text-accent">Witness</span>
          </a>
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-2">
            Verified communication history
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-10 w-full flex-1">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-2">
              Seal page
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-txt tracking-tight mb-1 font-mono">
              {decoded}
            </h1>
            <p className="text-sm text-muted">
              First witnessed {formatDate(record.first_seen)}
            </p>
          </div>
          {days >= 90 && record.event_count >= 10 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 bg-verified/10 border border-verified/25 text-verified text-xs font-semibold px-3 py-1.5 rounded-full font-mono">
              ✦ Verified
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard
            value={days.toString()}
            label="Days active"
            sub="since first CC"
          />
          <StatCard
            value={record.event_count.toString()}
            label="Witnessed emails"
            sub="DKIM-verified CCs"
          />
          <StatCard
            value={uniqueReceivers.toString()}
            label="Counterparties"
            sub="distinct domains"
          />
        </div>

        {/* Verified status */}
        <VerifiedStatus days={days} eventCount={record.event_count} />

        {/* What this means */}
        <div className="bg-surface border border-border rounded-2xl p-5 mb-8">
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-3">
            What this record proves
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Every entry in this record is backed by a cryptographic DKIM signature —
            a digital seal created by{" "}
            <span className="text-txt font-medium">{decoded}</span>&apos;s own email
            server. This proves the domain was operational and actively emailing
            real counterparties on those dates. The record cannot be backdated,
            manufactured, or edited — only new entries can be added, by sending
            more emails.
          </p>
        </div>

        {/* Activity feed */}
        {events.length > 0 && (
          <div className="mb-8">
            <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-4">
              Recent witnessed activity
            </p>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              {events.slice(0, 20).map((event, i) => (
                <div
                  key={(event as WitnessEvent).id}
                  className={`flex items-center justify-between px-5 py-3.5 ${
                    i < events.slice(0, 20).length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    <span className="text-sm font-mono text-txt">
                      {event.receiver_domain}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-2">
                    {formatDateShort(event.witnessed_at)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-2 mt-2 px-1">
              Each row is one DKIM-verified email sent to that domain.
            </p>
          </div>
        )}

        {/* Footer CTA */}
        <div className="border-t border-border pt-8 text-center">
          <p className="text-xs text-muted-2 mb-2">
            This record is built by CCing{" "}
            <code className="font-mono text-accent-2 text-[0.75rem] bg-surface border border-border px-1.5 py-0.5 rounded">
              sealed@witnessed.cc
            </code>{" "}
            on business emails.
          </p>
          <a
            href="/"
            className="text-xs text-muted hover:text-txt transition-colors"
          >
            Learn how it works →
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-5 py-5 mt-auto">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="font-mono text-[0.68rem] text-muted-2">
            © {new Date().getFullYear()} Signet Witness
          </p>
          <a
            href="mailto:hello@witnessed.cc"
            className="font-mono text-[0.68rem] text-muted-2 hover:text-muted transition-colors"
          >
            hello@witnessed.cc
          </a>
        </div>
      </footer>
    </main>
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
    <div className="bg-surface border border-border rounded-2xl p-4">
      <p className="text-2xl font-bold text-txt font-mono mb-0.5">{value}</p>
      <p className="text-xs text-txt font-medium mb-0.5">{label}</p>
      <p className="text-[0.65rem] text-muted-2">{sub}</p>
    </div>
  );
}

function UnclaimedPage({
  domain,
  receiverCount,
}: {
  domain: string;
  receiverCount: number;
}) {
  if (receiverCount === 0) notFound();

  return (
    <main className="flex flex-col min-h-screen bg-bg">
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight text-txt hover:opacity-80 transition-opacity">
            Signet <span className="text-accent">Witness</span>
          </a>
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-2">
            Verified communication history
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-10 w-full flex-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-2">
          Seal page
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-txt tracking-tight mb-1 font-mono">
          {domain}
        </h1>

        <div className="bg-surface border border-border rounded-2xl p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-txt">No history claimed</p>
          </div>
          <p className="text-sm text-muted leading-relaxed mb-4">
            <span className="text-txt font-medium font-mono">{domain}</span> appears
            as a recipient in{" "}
            <span className="text-txt font-medium">{receiverCount}</span>{" "}
            witnessed {receiverCount === 1 ? "communication" : "communications"}.
            Other businesses have already emailed this domain and CC&apos;d
            Signet — but{" "}
            <span className="font-mono text-txt">{domain}</span> hasn&apos;t
            started building its own record yet.
          </p>
          <div className="bg-bg border border-border rounded-xl p-4">
            <p className="text-xs text-muted leading-relaxed">
              Own this domain? Start CCing{" "}
              <code className="font-mono text-accent-2 text-[0.72rem]">
                sealed@witnessed.cc
              </code>{" "}
              on your outgoing business emails.{" "}
              <a href="/" className="text-accent hover:text-accent-2 transition-colors">
                Learn how →
              </a>
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border px-5 py-5 mt-auto">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="font-mono text-[0.68rem] text-muted-2">
            © {new Date().getFullYear()} Signet Witness
          </p>
          <a
            href="mailto:hello@witnessed.cc"
            className="font-mono text-[0.68rem] text-muted-2 hover:text-muted transition-colors"
          >
            hello@witnessed.cc
          </a>
        </div>
      </footer>
    </main>
  );
}
