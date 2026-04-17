import DomainSearch from "./components/DomainSearch";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-bg">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-txt">
            Signet <span className="text-accent">Witness</span>
          </span>
          <a
            href="/b/witnessed.cc"
            className="text-xs font-mono text-muted hover:text-txt transition-colors border border-border hover:border-border-h rounded-lg px-3 py-1.5"
          >
            See an example →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 py-16 sm:py-24 text-center max-w-2xl mx-auto w-full">

        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-2 mb-6">
          Proof of presence
        </p>

        <h1 className="text-[2.2rem] sm:text-[3rem] font-bold tracking-tight leading-[1.06] mb-6">
          AI can fake everything
          <br />
          <span className="text-accent">except yesterday.</span>
        </h1>

        <p className="text-base text-muted leading-relaxed mb-10 max-w-lg">
          CC{" "}
          <code className="font-mono text-sm bg-surface border border-border px-1.5 py-0.5 rounded-md text-accent-2">
            sealed@witnessed.cc
          </code>{" "}
          on your business emails. Signet verifies the DKIM signature, records
          who you emailed and when, and discards everything else. Your domain
          builds a verified history — passively, permanently, impossible to fake.
        </p>

        {/* How to start */}
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 text-left mb-10">
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-4">
            How to start
          </p>
          <ol className="space-y-4 text-sm text-muted">
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs flex items-center justify-center font-semibold font-mono mt-0.5">
                1
              </span>
              Open any business email you&apos;re about to send.
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs flex items-center justify-center font-semibold font-mono mt-0.5">
                2
              </span>
              <span>
                Add{" "}
                <code className="font-mono text-xs bg-bg border border-border px-1.5 py-0.5 rounded text-accent-2">
                  sealed@witnessed.cc
                </code>{" "}
                to the CC field.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs flex items-center justify-center font-semibold font-mono mt-0.5">
                3
              </span>
              Send it. Your seal page appears within minutes at{" "}
              <code className="font-mono text-xs text-muted-2">
                witnessed.cc/b/yourdomain
              </code>
            </li>
          </ol>
        </div>

        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-2 mb-3">
          No account · No signup · No setup
        </p>
      </section>

      {/* Domain search */}
      <section className="border-t border-border bg-surface px-5 py-14">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-3">
            Domain lookup
          </p>
          <h2 className="text-xl font-semibold text-txt mb-2">
            Is a domain already building history?
          </h2>
          <p className="text-sm text-muted mb-6">
            Search any domain to see its seal page — or find out how many times it
            appears as a counterparty before it&apos;s claimed its own record.
          </p>
          <div className="flex justify-center">
            <DomainSearch />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-border px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-10 text-center">
            What you get
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-lg mb-3">⚡</p>
              <p className="font-semibold text-txt mb-2 text-sm">Instant seal page</p>
              <p className="text-xs text-muted leading-relaxed">
                A public page at{" "}
                <code className="font-mono text-muted-2 text-[0.68rem]">
                  witnessed.cc/b/yourdomain
                </code>{" "}
                goes live after your first CC. Share it in proposals, invoices,
                email signatures.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-lg mb-3">🔐</p>
              <p className="font-semibold text-txt mb-2 text-sm">DKIM verified</p>
              <p className="text-xs text-muted leading-relaxed">
                Every record is backed by a cryptographic DKIM signature from your
                email domain. Not self-reported. Not gameable. Independently
                verifiable.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-lg mb-3">✦</p>
              <p className="font-semibold text-txt mb-2 text-sm">Verified at 90 days</p>
              <p className="text-xs text-muted leading-relaxed">
                Consistent activity for 90 days earns a Verified badge. A scammer
                can copy the image. They can&apos;t copy the history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-border px-5 py-10 bg-surface">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-2 mb-3">
            Privacy by design
          </p>
          <p className="text-sm text-muted leading-relaxed">
            <span className="text-txt font-medium">Stored:</span> sender domain,
            receiver domain, timestamp, DKIM signature hash.{" "}
            <span className="text-txt font-medium">Discarded immediately:</span>{" "}
            email body, subject line, attachments, all personal content. No human
            at Signet can read your emails. The CC is a voluntary act on each
            individual email.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-5 py-5">
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
