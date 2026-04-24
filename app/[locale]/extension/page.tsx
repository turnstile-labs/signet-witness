import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import InstallState from "@/app/components/InstallState";

// /extension — the single landing page for the Chrome extension.
//
// Structure mirrors /setup and /privacy so the site reads as one family:
// centered hero with the primary action (install), an editorial body
// with two features (write-side, read-side), a privacy reassurance
// block, and two "if this isn't you" escape hatches pointing to the
// admin recipes and the manual BCC.
//
// The install CTA is a client component because it probes the browser
// to tell "installed" from "not installed" via a chrome.runtime
// PING — see InstallState.tsx. The rest of the page is static.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "extensionPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ExtensionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("extensionPage");

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 sm:pb-12 text-center">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-4">
            {t("eyebrow")}
          </p>
          <h1 className="text-[2.25rem] sm:text-5xl font-bold tracking-tight text-txt leading-[1.05] mb-5">
            {t("title")}
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed mb-10">
            {t("intro")}
          </p>

          <InstallState />
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-12">
          <Feature
            title={t("featureWriteTitle")}
            body={t("featureWriteBody")}
          />
          <Feature title={t("featureReadTitle")} body={t("featureReadBody")} />
        </div>

        {/* ── Privacy reassurance ─────────────────────────────── */}
        <section className="border-y border-border bg-surface py-12 sm:py-14">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-xl sm:text-2xl font-bold text-txt mb-4">
              {t("privacyTitle")}
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              {t("privacyBody")}
            </p>
            <Link
              href="/privacy"
              className="text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              {t("privacyLink")}
            </Link>
          </div>
        </section>

        {/* ── Escape hatches ──────────────────────────────────── */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
          <div className="grid sm:grid-cols-2 gap-6">
            <EscapeHatch
              label={t("altSetup")}
              linkLabel={t("altSetupLink")}
              href="/setup"
            />
            <EscapeHatch
              label={t("altManual")}
              linkLabel={t("altManualLink")}
              href="/setup"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ── Primitives ───────────────────────────────────────────────

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-10 pt-8 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
      <h2 className="text-lg sm:text-xl font-bold text-txt mb-3">{title}</h2>
      <p className="text-sm text-muted leading-relaxed max-w-xl">{body}</p>
    </section>
  );
}

function EscapeHatch({
  label,
  linkLabel,
  href,
}: {
  label: string;
  linkLabel: string;
  href: "/setup" | "/privacy" | "/";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-sm text-muted mb-2">{label}</p>
      <Link
        href={href}
        className="text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
