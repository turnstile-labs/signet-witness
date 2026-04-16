import { notFound } from "next/navigation";
import { getDomain, getEvents, getReceiverCount } from "@/lib/db";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `${domain} — Signet`,
    description: `Verified communication history for ${domain}.`,
  };
}

function daysActive(firstSeen: string): number {
  const ms = Date.now() - new Date(firstSeen).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isVerified(days: number, eventCount: number): boolean {
  return days >= 90 && eventCount >= 10;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function SealPage({ params }: Props) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain).toLowerCase().trim();

  const record = await getDomain(decoded);

  // Domain has never sent a witnessed email — check if it appears as a receiver
  if (!record) {
    const receiverCount = await getReceiverCount(decoded);
    return <UnclaimedPage domain={decoded} receiverCount={receiverCount} />;
  }

  const events = await getEvents(record.id);
  const days = daysActive(record.first_seen);
  const verified = isVerified(days, record.event_count);
  const uniqueReceivers = new Set(events.map((e) => e.receiver_domain)).size;

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 max-w-3xl mx-auto flex items-center justify-between">
        <a href="/" className="text-sm font-semibold text-gray-900 hover:opacity-70 transition-opacity">
          Signet
        </a>
        <span className="text-xs text-gray-400">Verified communication history</span>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
              {decoded}
            </h1>
            <p className="text-sm text-gray-500">
              First witnessed {formatDate(record.first_seen)}
            </p>
          </div>
          {verified && (
            <div className="flex-shrink-0 bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              ✦ Verified
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <StatCard label="Days active" value={days.toString()} />
          <StatCard label="Witnessed emails" value={record.event_count.toString()} />
          <StatCard label="Unique counterparties" value={uniqueReceivers.toString()} />
        </div>

        {/* Verification status */}
        {verified ? (
          <div className="bg-gray-900 text-white rounded-xl p-5 mb-10">
            <p className="text-sm font-semibold mb-1">✦ {decoded} · Verified · {days} Days Active</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              This domain has maintained consistent, DKIM-verified email communication
              for over 90 days with {uniqueReceivers} distinct counterparties. History
              is independently verifiable — it cannot be fabricated or backdated.
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-10">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Building history — {90 - days > 0 ? `${90 - days} days until Verified` : "verification pending"}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Verified status is earned after 90 days of consistent CC activity with at
              least 10 witnessed emails. Every CC strengthens the record.
            </p>
          </div>
        )}

        {/* Recent activity */}
        {events.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Recent witnessed activity
            </h2>
            <div className="space-y-2">
              {events.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-700">{event.receiver_domain}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(event.witnessed_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works link */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            This record is built by CCing{" "}
            <code className="bg-gray-100 px-1 rounded">witness@signet.id</code> on
            business emails.{" "}
            <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-2">
              Learn how it works →
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
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
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-6 py-4 max-w-3xl mx-auto flex items-center justify-between">
        <a href="/" className="text-sm font-semibold text-gray-900 hover:opacity-70 transition-opacity">
          Signet
        </a>
        <span className="text-xs text-gray-400">Verified communication history</span>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
          {domain}
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-6">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            No history claimed
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            <strong>{domain}</strong> appears as a recipient in{" "}
            <strong>{receiverCount}</strong> witnessed{" "}
            {receiverCount === 1 ? "communication" : "communications"} — but
            this domain has not started building its own history yet.
          </p>
          <p className="text-sm text-amber-700 mt-3 leading-relaxed">
            Own this domain? Start CCing{" "}
            <code className="bg-amber-100 px-1 rounded text-xs font-mono">
              witness@signet.id
            </code>{" "}
            on your business emails to claim it.{" "}
            <a href="/" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
              Learn how →
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
