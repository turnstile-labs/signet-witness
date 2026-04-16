export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto w-full">
        <span className="font-semibold tracking-tight text-gray-900">Signet</span>
        <a
          href="/b/witnessed.cc"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          See an example →
        </a>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center max-w-2xl mx-auto w-full">
        <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-6">
          Proof of presence
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight mb-6">
          AI can fake everything
          <br />
          except yesterday.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-xl">
          CC{" "}
          <code className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-base font-mono">
            signet@witnessed.cc
          </code>{" "}
          on your business emails. Signet verifies the DKIM signature, records
          who you emailed and when, and discards everything else. Your domain
          builds a verified communication history — passively, permanently, and
          impossible to manufacture.
        </p>

        {/* CC instruction */}
        <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-6 text-left mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            How to start
          </p>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
                1
              </span>
              Open any business email you&apos;re about to send.
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
                2
              </span>
              Add{" "}
              <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-xs">
                signet@witnessed.cc
              </code>{" "}
              to the CC field.
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
                3
              </span>
              Send it. Your seal page appears within minutes.
            </li>
          </ol>
        </div>

        <p className="text-sm text-gray-400">
          No account. No signup. No setup. The CC is the product.
        </p>
      </section>

      {/* What you get */}
      <section className="border-t border-gray-100 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            What happens after you CC
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <div className="text-2xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Instant seal page
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A public page appears at{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  witnessed.cc/b/yourdomain
                </code>{" "}
                showing your first witnessed date and activity count. Share it
                anywhere.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-3">🔒</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                DKIM verified
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every record is backed by a cryptographic DKIM signature from
                your email domain. Not self-reported. Independently verifiable.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-3">✦</div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Verified badge at 90 days
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                After 90 days of consistent activity your domain earns a
                Verified badge. A scammer can copy the image. They can&apos;t
                copy the history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy strip */}
      <section className="border-t border-gray-100 bg-gray-50 px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Privacy by design.</strong> Signet
            stores sender domain, receiver domain, timestamp, and a DKIM
            signature hash. Email body, subject line, and all personal content
            are discarded immediately — never stored, never read. The CC is an
            explicit, voluntary act on each individual email.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Signet ·{" "}
          <a href="mailto:hello@witnessed.cc" className="hover:text-gray-600 transition-colors">
            hello@witnessed.cc
          </a>
        </p>
      </footer>
    </main>
  );
}
