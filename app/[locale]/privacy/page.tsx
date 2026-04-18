import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Privacy — Witnessed",
  description: "How Witnessed handles your data.",
};

export default async function PrivacyPage({
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
        <h1 className="text-3xl font-bold text-txt mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-12">Last updated: April 2026</p>

        <div className="space-y-10 text-sm text-muted leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">The short version</h2>
            <p>
              We record only what&apos;s needed to verify that a business email was sent:
              the sender&apos;s domain, the recipient&apos;s domain, the timestamp, and a
              hash of the DKIM signature. We never see, store, or process the content
              of your emails. The CC is an explicit, voluntary act — nothing is
              collected without your deliberate action.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">What we collect</h2>
            <p className="mb-4">When you CC <code className="font-mono text-txt text-xs bg-surface border border-border px-1.5 py-0.5 rounded">sealed@witnessed.cc</code> on an email, we record:</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              <li><span className="text-txt font-medium">Sender domain</span> — the domain portion of your From address (e.g. <code className="font-mono text-xs">acme.com</code>)</li>
              <li><span className="text-txt font-medium">Recipient domain</span> — the domain of the primary recipient</li>
              <li><span className="text-txt font-medium">Timestamp</span> — when the email was received by our system</li>
              <li><span className="text-txt font-medium">DKIM signature hash</span> — a one-way hash used to verify authenticity; the original signature is discarded</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">What we never collect</h2>
            <p className="mb-4">The following are discarded immediately upon receipt and never stored:</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              <li>Email subject line</li>
              <li>Email body</li>
              <li>Attachments</li>
              <li>Personal names, addresses, or contact information</li>
              <li>Any content from your email</li>
            </ul>
            <p className="mt-4">No human at Witnessed ever reads your emails. This is enforced architecturally — email content never reaches our database.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">How we use this data</h2>
            <p className="mb-3">The data we collect is used solely to:</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              <li>Build and display the public seal page for your domain at <code className="font-mono text-xs">witnessed.cc/b/yourdomain</code></li>
              <li>Compute the verified business history metrics shown on that page</li>
              <li>Power the verification record that proves your business has been operational over time</li>
            </ul>
            <p className="mt-4">We do not sell data, share it with third parties for advertising, or use it for any purpose other than the above.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Consent model</h2>
            <p>
              The CC is an explicit, voluntary act on each individual email. You are in
              full control of which emails contribute to your record. There is no passive
              collection — Witnessed only receives data when you deliberately include the
              address in a CC field.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Public records</h2>
            <p>
              Seal pages are public by design. The domain name, event count, first-seen
              date, and recipient domains are visible to anyone who visits
              your seal page. This is the product — the public proof of business activity.
              If you do not want a public record for your domain, do not CC the address.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Data retention and deletion</h2>
            <p>
              Your domain&apos;s history is retained for as long as the service operates.
              You may request deletion of all records associated with your domain at any
              time by emailing <a href="mailto:hello@witnessed.cc" className="text-accent hover:text-accent-2 transition-colors">hello@witnessed.cc</a> from
              an address at that domain. Deletion is permanent and irreversible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Infrastructure and security</h2>
            <p>
              Data is stored on Vercel Postgres (Neon), encrypted at rest and in transit.
              Access is restricted to the application layer. No employee has direct
              database access in production.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Changes to this policy</h2>
            <p>
              If we make material changes, we will update the date at the top of this
              page. Continued use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">Contact</h2>
            <p>
              Questions about this policy:{" "}
              <a href="mailto:hello@witnessed.cc" className="text-accent hover:text-accent-2 transition-colors">hello@witnessed.cc</a>
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
