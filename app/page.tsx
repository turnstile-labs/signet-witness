import Link from "next/link";
import DomainSearch from "./components/DomainSearch";
import ThemeToggle from "./components/ThemeToggle";
import Footer from "./components/Footer";
import CopyableEmail from "./components/CopyableEmail";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-txt">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
            <span className="text-accent text-base">✦</span>
            <span className="text-txt">Witnessed</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/b/witnessed.cc"
              className="text-xs text-muted hover:text-txt transition-colors"
            >
              See an example
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-muted mb-8 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
            Proof of business
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-txt leading-[1.05] mb-5">
            AI can fake everything.
            <br />
            <span className="text-accent">Except yesterday.</span>
          </h1>

          <p className="text-lg text-muted max-w-xl mx-auto leading-relaxed mb-10">
            A verifiable record of every business email you send —
            built automatically, impossible to backdate.
          </p>

          <CopyableEmail variant="hero" />

          <div className="mt-10 pt-8 border-t border-border flex flex-col items-center gap-3">
            <p className="text-xs text-muted-2 uppercase tracking-widest font-mono">
              Or look up any business
            </p>
            <DomainSearch />
          </div>
        </section>

        {/* ── Live seal page mock (moved up — show the outcome) ─── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-xs font-mono text-muted-2 uppercase tracking-widest mb-3">
                Every domain gets one
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
                A public page anyone can check.
              </h2>
              <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">
                Real sender. Real timestamps. Real volume. Nothing staged,
                nothing self-reported.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-bg overflow-hidden shadow-sm">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-xs font-mono text-muted">
                    AC
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-txt">acmecorp.com</p>
                    <p className="text-xs text-muted font-mono">witnessed.cc/b/acmecorp.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-verified/30 bg-verified/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-verified inline-block" />
                  <span className="text-xs font-semibold text-verified">Verified Active</span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-3 gap-4">
                {[
                  { value: "847", label: "Verified emails", sub: "independently confirmed" },
                  { value: "14 mo", label: "Active history", sub: "first to last email" },
                  { value: "98%", label: "Consistency", sub: "no suspicious gaps" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-2xl font-bold text-txt font-mono">{stat.value}</p>
                    <p className="text-xs font-semibold text-txt mt-0.5">{stat.label}</p>
                    <p className="text-xs text-muted-2 mt-0.5">{stat.sub}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border px-6 py-4">
                <p className="text-xs text-muted text-center">
                  <span className="text-accent font-semibold">This record cannot be backdated.</span>{" "}
                  Each entry is verified at the moment of sending — not self-reported.
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-muted-2 mt-6">
              Want to see a real one?{" "}
              <Link href="/b/witnessed.cc" className="text-accent hover:underline">
                View witnessed.cc →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Why this matters (2 columns) ─────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
              Trust, without the theater.
            </h2>
            <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">
              Anyone can generate a polished website, a LinkedIn history, or a
              wall of testimonials. No one can retroactively send email.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
            <div className="px-6 py-7 bg-surface">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-400 text-sm font-bold">✗</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  AI can fake
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-muted">
                {[
                  "Testimonials",
                  "Case studies",
                  "Portfolio sites",
                  "Press releases",
                  "LinkedIn history",
                  "About pages",
                  "Service agreements",
                  "“Years in business”",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-2 inline-block" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-6 py-7 bg-surface-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-verified text-sm font-bold">✓</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-verified">
                  AI can't fake
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-muted">
                {[
                  "Verified email timestamps",
                  "A real history of real conversations",
                  "Volume no one can manufacture",
                  "A track record that only grows with time",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-verified inline-block" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── How it works (horizontal on desktop) ──────────────── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
                Three steps. The last one is forever.
              </h2>
              <p className="text-muted text-sm max-w-sm mx-auto">
                No app. No account. Just one CC.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  n: "01",
                  title: "Add one CC",
                  body: "CC sealed@witnessed.cc on your business emails — proposals, invoices, follow-ups.",
                },
                {
                  n: "02",
                  title: "We verify",
                  body: "The DKIM signature from your mail server is tamper-proof. We check it, log metadata, discard the rest.",
                },
                {
                  n: "03",
                  title: "Your proof grows",
                  body: "Your public record at witnessed.cc/b/yourdomain accumulates automatically. Longer history, stronger proof.",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-xl border border-border bg-bg px-5 py-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent tracking-widest">
                      {step.n}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="font-semibold text-txt text-base">
                    {step.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Private by design ────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-20">
          <div className="flex flex-col sm:flex-row gap-10 sm:gap-14 items-start">
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-4">
                Private by design.
              </h2>
              <p className="text-muted text-sm leading-relaxed mb-4">
                Your emails contain sensitive information. We never see it.
                The CC reaches us, we verify the sender, record the
                timestamp, and discard everything else.
              </p>
              <p className="text-muted text-sm leading-relaxed">
                You choose which conversations count. Nothing is collected
                without an explicit CC from you.
              </p>
            </div>
            <div className="shrink-0 sm:w-64 w-full rounded-xl border border-border bg-surface overflow-hidden text-xs font-mono">
              <div className="border-b border-border px-4 py-2.5 text-muted-2 uppercase tracking-widest text-[0.6rem]">
                What we store
              </div>
              {[
                { label: "Sender domain", stored: true },
                { label: "Recipient domain", stored: true },
                { label: "Timestamp", stored: true },
                { label: "DKIM signature hash", stored: true },
                { label: "Email subject", stored: false },
                { label: "Email body", stored: false },
                { label: "Attachments", stored: false },
                { label: "Personal names", stored: false },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    i < arr.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-muted">{row.label}</span>
                  {row.stored ? (
                    <span className="text-verified">✓</span>
                  ) : (
                    <span className="text-muted-2">✗ never</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA (merged "always free" + business model) ── */}
        <section className="border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
              Start your record.
            </h2>
            <p className="text-muted text-sm max-w-md mx-auto leading-relaxed mb-8">
              Your seal page is free forever. CC one email and you're on the record.
            </p>

            <CopyableEmail variant="hero" caption="CC on your next business email" />

            <p className="text-xs text-muted-2 mt-8 max-w-sm mx-auto leading-relaxed">
              Free for senders. Funded by enterprises who use our verification
              API — and by on-demand credentials for high-stakes moments.
            </p>

            <p className="mt-6 text-xs text-muted-2">
              Built for freelancers, agencies, startups — anyone who needs to
              prove they&apos;ve been here.
            </p>
          </div>
        </section>

      </main>

      <Footer />

    </div>
  );
}
