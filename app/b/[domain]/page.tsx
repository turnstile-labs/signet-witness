import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomain, getEvents, getReceiverCount, type WitnessEvent } from "@/lib/db";
import type { Metadata } from "next";
import ThemeToggle from "@/app/components/ThemeToggle";
import Footer from "@/app/components/Footer";

interface Props {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `${domain} — Witnessed`,
    description: `Verified business history for ${domain}.`,
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

function domainInitials(domain: string): string {
  return domain.replace(/\.[^.]+$/, "").slice(0, 2).toUpperCase();
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <span className="text-accent text-base">✦</span>
          <span className="text-txt">Witnessed</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted hidden sm:block font-mono">
            Business history record
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}


function VerifiedStatus({ days, eventCount }: { days: number; eventCount: number }) {
  const daysNeeded = 90;
  const emailsNeeded = 10;
  const isVerified = days >= daysNeeded && eventCount >= emailsNeeded;
  const daysProgress = Math.min(100, Math.round((days / daysNeeded) * 100));
  const emailsProgress = Math.min(100, Math.round((eventCount / emailsNeeded) * 100));

  if (isVerified) {
    return (
      <div className="bg-verified/5 border border-verified/20 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-verified mt-0.5">✦</span>
          <div>
            <p className="text-sm font-semibold text-verified mb-1">Verified Active Business</p>
            <p className="text-xs text-muted leading-relaxed">
              This domain has maintained consistent, cryptographically verified email
              activity for over 90 days across multiple real counterparties.
              This history cannot be fabricated, backdated, or edited.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-txt">Building toward Verified</p>
        <span className="text-[0.65rem] text-muted-2 bg-bg border border-border px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">
          In progress
        </span>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4">
        Verified status requires 90+ days of activity and at least 10 witnessed emails.
        The longer the history, the more credible the record.
      </p>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5">
            <span>Days active</span>
            <span>{days} / 90</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${daysProgress}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-2 font-mono mb-1.5">
            <span>Witnessed emails</span>
            <span>{eventCount} / 10</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${emailsProgress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-2xl font-bold text-txt font-mono mb-0.5">{value}</p>
      <p className="text-xs text-txt font-medium mb-0.5">{label}</p>
      <p className="text-[0.65rem] text-muted-2">{sub}</p>
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
  const isVerified = days >= 90 && record.event_count >= 10;

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">

        {/* Domain header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-sm font-bold text-muted shrink-0">
              {domainInitials(decoded)}
            </div>
            <div>
              <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-1">Seal page</p>
              <h1 className="text-xl sm:text-2xl font-bold text-txt tracking-tight font-mono leading-none">
                {decoded}
              </h1>
              <p className="text-xs text-muted mt-1">
                First witnessed {formatDate(record.first_seen)}
              </p>
            </div>
          </div>
          {isVerified && (
            <div className="shrink-0 flex items-center gap-1.5 bg-verified/10 border border-verified/25 text-verified text-xs font-semibold px-3 py-1.5 rounded-full font-mono">
              ✦ Verified
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard value={days.toString()} label="Days active" sub="since first email" />
          <StatCard value={record.event_count.toString()} label="Sealed emails" sub="DKIM-verified" />
          <StatCard value={uniqueReceivers.toString()} label="Counterparties" sub="distinct domains" />
        </div>

        {/* Verified progress */}
        <VerifiedStatus days={days} eventCount={record.event_count} />

        {/* Plain-language explainer */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">
            What this record means
          </p>
          <div className="space-y-2.5">
            {[
              {
                icon: "🔏",
                text: `Every entry was signed by ${decoded}'s own mail server using DKIM — a cryptographic standard built into email. It cannot be forged.`,
              },
              {
                icon: "📅",
                text: "These timestamps were recorded in real time. No entry can be backdated — the history only grows forward.",
              },
              {
                icon: "🤝",
                text: `${decoded} was actively emailing real businesses on these dates. This is operational proof, not a self-reported claim.`,
              },
            ].map((item) => (
              <div key={item.icon} className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5 shrink-0">{item.icon}</span>
                <p className="text-sm text-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        {events.length > 0 && (
          <div className="mb-8">
            <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">
              Witnessed activity
            </p>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {events.slice(0, 20).map((event, i) => (
                <div
                  key={(event as WitnessEvent).id}
                  className={`flex items-center justify-between px-5 py-3 ${
                    i < Math.min(events.length, 20) - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="text-sm font-mono text-txt">{event.receiver_domain}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-2">{formatDateShort(event.witnessed_at)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-2 mt-2 px-1">
              Each row is one DKIM-verified email sent from {decoded} to that recipient.
            </p>
          </div>
        )}


      </main>

      <Footer />
    </div>
  );
}

function UnclaimedPage({ domain, receiverCount }: { domain: string; receiverCount: number }) {
  if (receiverCount === 0) notFound();

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10 w-full">

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-sm font-bold text-muted shrink-0">
            {domainInitials(domain)}
          </div>
          <div>
            <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-1">Seal page</p>
            <h1 className="text-xl sm:text-2xl font-bold text-txt tracking-tight font-mono leading-none">
              {domain}
            </h1>
          </div>
        </div>

        {/* Recipient notice */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <p className="text-sm font-semibold text-txt">No outbound record yet</p>
          </div>
          <p className="text-sm text-muted leading-relaxed mb-4">
            <span className="font-mono text-txt">{domain}</span> has been the recipient
            in{" "}
            <span className="font-semibold text-txt">{receiverCount}</span>{" "}
            witnessed {receiverCount === 1 ? "communication" : "communications"} — meaning
            other businesses have CC&apos;d Witnessed when emailing this domain. But{" "}
            <span className="font-mono text-txt">{domain}</span> hasn&apos;t started
            building its own outbound record yet.
          </p>
          <div className="bg-bg border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-txt mb-1">Own this domain?</p>
            <p className="text-xs text-muted leading-relaxed">
              Start CCing{" "}
              <code className="font-mono text-accent text-[0.72rem]">sealed@witnessed.cc</code>{" "}
              on your outgoing business emails to begin building your verified record.{" "}
              <Link href="/" className="text-accent hover:text-accent-2 transition-colors">
                Learn how →
              </Link>
            </p>
          </div>
        </div>

        {/* Explain what recipient activity means */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">
            What &quot;recipient activity&quot; means
          </p>
          <p className="text-sm text-muted leading-relaxed">
            When any business sends an email and CCs <code className="font-mono text-txt text-xs">sealed@witnessed.cc</code>,
            we record the recipient&apos;s domain too. This shows that real companies
            are doing business with <span className="font-mono text-txt">{domain}</span> —
            which is still meaningful signal, even without an active record from the domain itself.
          </p>
        </div>

      </main>

      <Footer />
    </div>
  );
}
