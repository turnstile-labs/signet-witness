import Link from "next/link";
import DomainSearch from "./components/DomainSearch";
import ThemeToggle from "./components/ThemeToggle";
import Footer from "./components/Footer";

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
        <section className="max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-xs text-muted mb-8 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
            The record AI can&apos;t write
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-txt leading-tight mb-6">
            AI can fake everything.
            <br />
            <span className="text-accent">Except yesterday.</span>
          </h1>

          <p className="text-lg text-muted max-w-xl mx-auto leading-relaxed mb-10">
            CC <span className="font-mono text-txt text-sm bg-surface border border-border px-2 py-0.5 rounded-md">sealed@witnessed.cc</span> on
            your business emails. We build a cryptographically verified
            history — automatically, passively, permanently.
          </p>

          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-muted-2">Look up any business</p>
            <DomainSearch />
          </div>
        </section>

        {/* ── The problem ──────────────────────────────────────── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="max-w-3xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
              {[
                {
                  icon: "✗",
                  color: "text-red-400",
                  label: "AI can fake",
                  items: ["Testimonials", "Case studies", "Portfolio sites", "Years in business"],
                },
                {
                  icon: "✗",
                  color: "text-red-400",
                  label: "AI can fake",
                  items: ["Press releases", "About pages", "LinkedIn history", "Service agreements"],
                },
                {
                  icon: "✓",
                  color: "text-verified",
                  label: "AI can't fake",
                  items: ["Email timestamps", "DKIM signatures", "Real conversations", "Accumulated history"],
                  highlight: true,
                },
              ].map((col) => (
                <div
                  key={col.label + col.items[0]}
                  className={`px-6 py-6 bg-surface flex flex-col gap-3 ${col.highlight ? "bg-surface-2" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${col.color}`}>{col.icon}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                  </div>
                  {col.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted">
                      <span className={`w-1 h-1 rounded-full inline-block ${col.highlight ? "bg-verified" : "bg-muted-2"}`} />
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-txt mb-3">How it works</h2>
            <p className="text-muted text-sm max-w-sm mx-auto">
              Three steps. The last one happens on its own, forever.
            </p>
          </div>

          <div className="flex flex-col gap-0">
            {[
              {
                n: "1",
                title: "Add one CC",
                body: "When sending a business email — proposals, invoices, contracts, follow-ups — CC sealed@witnessed.cc. That's the entire setup.",
                detail: "No app to install. No account to create.",
              },
              {
                n: "2",
                title: "We verify and store",
                body: "Each email arrives with a DKIM signature — a cryptographic proof that your mail server generated it. We verify and permanently record it.",
                detail: "Your email content is never stored.",
              },
              {
                n: "3",
                title: "Your seal page grows",
                body: "Every verified email adds to your public record at witnessed.cc/b/yourdomain.com — showing volume, consistency, and longevity.",
                detail: "The longer you send, the more trust you build.",
              },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-bold text-accent shrink-0">
                    {step.n}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px flex-1 bg-border my-2" />
                  )}
                </div>
                <div className="pb-10 pt-1 flex-1">
                  <h3 className="font-semibold text-txt text-base mb-1.5">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed mb-1">{step.body}</p>
                  <p className="text-muted-2 text-xs font-mono">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What you get ─────────────────────────────────────── */}
        <section className="border-y border-border bg-surface py-16">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-txt mb-3">What you get</h2>
              <p className="text-muted text-sm max-w-sm mx-auto">
                A public seal page anyone can visit to verify your business history.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-bg overflow-hidden">
              {/* Mock seal page header */}
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
                  { value: "847", label: "Sealed emails", sub: "cryptographically verified" },
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
                  Each entry was verified in real-time using DKIM cryptographic signatures.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Who this is for ──────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-txt mb-3">Built for businesses that do real work</h2>
            <p className="text-muted text-sm max-w-sm mx-auto">
              Anyone who needs to prove they were there before anyone was looking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                who: "Freelancers & agencies",
                why: "Prove you've been in business longer than your website says. Show clients your track record is real.",
              },
              {
                who: "Early-stage startups",
                why: "Build credibility before you have press coverage, testimonials, or case studies to show.",
              },
              {
                who: "Service providers",
                why: "Stand out in a market flooded with AI-generated portfolios and fake social proof.",
              },
              {
                who: "Enterprise vendors",
                why: "Give procurement teams and compliance auditors an independent, verifiable communication history.",
              },
            ].map((item) => (
              <div
                key={item.who}
                className="rounded-xl border border-border bg-surface px-5 py-4"
              >
                <p className="text-sm font-semibold text-txt mb-1.5">{item.who}</p>
                <p className="text-sm text-muted leading-relaxed">{item.why}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Privacy ──────────────────────────────────────────── */}
        <section className="border-t border-border bg-surface py-14">
          <div className="max-w-3xl mx-auto px-6">
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-12 items-start">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-txt mb-3">Your content stays private</h2>
                <p className="text-sm text-muted leading-relaxed">
                  We record only the metadata — sender domain, timestamp, and DKIM
                  verification result. The body of your email is never read, stored,
                  or processed.
                </p>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-txt mb-3">Cryptographic, not claimed</h2>
                <p className="text-sm text-muted leading-relaxed">
                  DKIM signatures are issued by your mail provider and can only be
                  generated at send time. They cannot be forged after the fact — which
                  is exactly what makes this proof meaningful.
                </p>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-txt mb-3">Free to start</h2>
                <p className="text-sm text-muted leading-relaxed">
                  Every business starts on the free tier. No credit card.
                  Send your first email and your seal page is live within minutes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ───────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-2xl font-bold text-txt mb-3">
            Start your record today
          </h2>
          <p className="text-muted text-sm mb-8 max-w-xs mx-auto">
            No signup. Add one CC and your history starts building itself.
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-accent/30 bg-accent/5">
              <span className="text-xs text-muted font-mono">CC this address on your next email:</span>
              <code className="text-sm font-mono font-semibold text-accent">sealed@witnessed.cc</code>
            </div>
            <p className="text-xs text-muted-2">Or look up a business that&apos;s already building their record:</p>
            <DomainSearch />
          </div>
        </section>

      </main>

      <Footer />

    </div>
  );
}
