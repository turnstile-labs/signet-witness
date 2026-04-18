import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Terms — Witnessed",
  description: "Terms of service for Witnessed.",
};

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="flex flex-col min-h-screen bg-bg">

      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">

        <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">Legal</p>
        <h1 className="text-3xl font-bold text-txt mb-2">Terms of Service</h1>
        <p className="text-sm text-muted mb-12">Last updated: April 2026</p>

        <div className="space-y-10 text-sm text-muted leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">What Witnessed is</h2>
            <p>
              Witnessed (<code className="font-mono text-xs">witnessed.cc</code>) is a
              service that builds a verified business history for email domains. When you
              CC <code className="font-mono text-txt text-xs bg-surface border border-border px-1.5 py-0.5 rounded">sealed@witnessed.cc</code> on
              a business email, we verify the DKIM signature, record the metadata, and
              add it to the public proof-of-business record for your domain.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Acceptance</h2>
            <p>
              By using this service — including by CCing our address, visiting a seal
              page, or using the verification API — you agree to these terms. If you
              do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Acceptable use</h2>
            <p className="mb-3">You agree not to use Witnessed to:</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              <li>Generate false or misleading business history (e.g. coordinated networks of domains CCing each other to manufacture artificial credibility)</li>
              <li>Impersonate another business or domain you do not control</li>
              <li>Attempt to manipulate, reverse-engineer, or tamper with the verification system</li>
              <li>Abuse the service in a way that degrades performance for other users</li>
            </ul>
            <p className="mt-4">
              We reserve the right to remove, flag, or permanently downgrade records
              associated with domains found to be engaging in manipulation.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">The seal page is public</h2>
            <p>
              Once your domain has been witnessed, a public seal page exists at
              <code className="font-mono text-xs mx-1">witnessed.cc/b/yourdomain</code>.
              This page is publicly accessible and indexed. You agree that building a
              record using our service means this page may be visible to anyone.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">What Witnessed proves and does not prove</h2>
            <p>
              Witnessed proves that a domain has been sending DKIM-authenticated email
              to real counterparties over a period of time. It does not prove legal
              standing, financial solvency, compliance with any regulation, or the
              quality or legitimacy of the underlying business activity.
            </p>
            <p className="mt-3">
              Verified status is a signal, not a guarantee. Do not rely on a Witnessed
              record as the sole basis for a high-stakes business decision.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Service availability</h2>
            <p>
              We provide Witnessed on an as-is, as-available basis. We do not guarantee
              uptime, data retention beyond reasonable commercial practice, or continuity
              of the service. We will make reasonable efforts to preserve records, but
              cannot be held liable for data loss.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Witnessed and its operators are
              not liable for any indirect, incidental, special, consequential, or
              punitive damages arising from your use of the service, including but not
              limited to loss of business, loss of data, or reliance on a verified record.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Termination</h2>
            <p>
              We may suspend or terminate access to the service at any time, with or
              without notice, for conduct that violates these terms or that we determine
              is harmful to the integrity of the record.
            </p>
            <p className="mt-3">
              You may request deletion of your domain&apos;s record at any time. See
              our <Link href="/privacy" className="text-accent hover:text-accent-2 transition-colors">Privacy Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Changes to these terms</h2>
            <p>
              We may update these terms from time to time. We will update the date at
              the top of this page. Continued use of the service after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a href="mailto:hello@witnessed.cc" className="text-accent hover:text-accent-2 transition-colors">hello@witnessed.cc</a>
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
