import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Footer from "@/app/components/Footer";
import CopyableEmail from "@/app/components/CopyableEmail";
import NavBar from "@/app/components/NavBar";
import HeroBackdrop from "@/app/components/HeroBackdrop";
import DomainSearch from "@/app/components/DomainSearch";

export const revalidate = 300;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");

  return (
    <div className="flex flex-col min-h-screen bg-bg text-txt">

      <NavBar />

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <HeroBackdrop />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-16 sm:pb-20 text-center">

            <h1 className="text-[2.5rem] sm:text-5xl font-bold tracking-tight text-txt leading-[1.05] mb-6">
              {t("headline1")}
              <br />
              <span className="text-accent">{t("headline2")}</span>
            </h1>

            <p className="text-base sm:text-lg text-muted max-w-lg mx-auto leading-relaxed mb-10">
              {t("subhead")}
            </p>

            <CopyableEmail variant="hero" />

          </div>
        </section>

        {/* ── Badge: the primary product surface ──────────────── */}
        <section className="border-y border-border bg-surface py-14 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <p className="text-xs font-mono text-muted-2 uppercase tracking-widest mb-3">
                {t("badge.eyebrow")}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
                {t("badge.title")}
              </h2>
              <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">
                {t("badge.sub")}
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-xl border border-border bg-bg overflow-hidden shadow-sm">
              <div className="px-5 py-2.5 border-b border-border text-[0.6rem] font-mono uppercase tracking-widest text-muted-2">
                {t("badge.mockLabel")}
              </div>
              <div className="px-5 py-5">
                <p className="text-sm font-semibold text-txt leading-tight">
                  {t("badge.signatureName")}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t("badge.signatureRole")}
                </p>
                <p className="text-[0.7rem] text-muted-2 mt-1 font-mono">
                  {t("badge.signatureContact")}
                </p>
                <div className="mt-4">
                  <Link href="/b/witnessed.cc" className="inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/badge/witnessed.cc.svg"
                      alt="Witnessed · witnessed.cc"
                      width={220}
                      height={32}
                      className="border-0 inline-block align-middle light:hidden"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/badge/witnessed.cc.svg?theme=light"
                      alt="Witnessed · witnessed.cc"
                      width={220}
                      height={32}
                      className="border-0 hidden align-middle light:inline-block"
                    />
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-2 leading-relaxed max-w-md mx-auto">
              {t("badge.footnote")}
            </p>
          </div>
        </section>

        {/* ── Click destination: the full public page ─────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-mono text-muted-2 uppercase tracking-widest mb-3">
              {t("mock.eyebrow")}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-3">
              {t("mock.title")}
            </h2>
            <p className="text-muted text-sm max-w-md mx-auto leading-relaxed">
              {t("mock.sub")}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
            <div className="border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-[0.7rem] sm:text-xs font-mono text-muted shrink-0">
                  AC
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-txt truncate">acmecorp.com</p>
                  <p className="text-[0.7rem] sm:text-xs text-muted font-mono truncate">witnessed.cc/b/acmecorp.com</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-verified/30 bg-verified/10 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-verified inline-block" />
                <span className="text-[0.7rem] sm:text-xs font-semibold text-verified">{t("mock.verifiedActive")}</span>
              </div>
            </div>

            <div className="px-2 sm:px-6 py-5 sm:py-6 grid grid-cols-3 gap-1 sm:gap-4">
              {[
                { value: "847",   label: t("mock.statsVerifiedEmails"), sub: t("mock.statsVerifiedEmailsSub") },
                { value: "14 mo", label: t("mock.statsActiveHistory"),  sub: t("mock.statsActiveHistorySub") },
                { value: "23",    label: t("mock.statsCounterparties"), sub: t("mock.statsCounterpartiesSub") },
              ].map((stat) => (
                <div key={stat.label} className="text-center px-1">
                  <p className="text-xl sm:text-2xl font-bold text-txt font-mono leading-none">{stat.value}</p>
                  <p className="text-[0.7rem] sm:text-xs font-semibold text-txt mt-1">{stat.label}</p>
                  <p className="text-[0.6rem] sm:text-[0.65rem] text-muted-2 mt-0.5 leading-tight">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-4 sm:px-6 py-3">
              <p className="text-[0.7rem] sm:text-xs text-muted text-center leading-relaxed">
                <span className="text-accent font-semibold">{t("mock.disclaimerStrong")}</span>{" "}
                {t("mock.disclaimerRest")}
              </p>
            </div>
          </div>

          <div className="mt-10 sm:mt-12">
            <p className="text-center text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-3">
              {t("mock.lookupLabel")}
            </p>
            <DomainSearch
              placeholder={t("mock.lookupPlaceholder")}
              submitLabel={t("mock.lookupSubmit")}
              ariaLabel={t("mock.lookupAria")}
            />
            <p className="text-center text-xs text-muted-2 mt-4">
              {t("mock.realOne")}{" "}
              <Link
                href="/b/witnessed.cc"
                className="text-accent hover:underline font-mono whitespace-nowrap"
              >
                witnessed.cc →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Private by design ────────────────────────────────── */}
        <section className="border-y border-border bg-surface py-14 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-14 items-start">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-txt mb-4">
                  {t("privacy.title")}
                </h2>
                <p className="text-muted text-sm leading-relaxed mb-4">
                  {t("privacy.body1")}
                </p>
                <p className="text-muted text-sm leading-relaxed">
                  {t("privacy.body2")}
                </p>
              </div>
              <div className="shrink-0 sm:w-64 w-full rounded-xl border border-border bg-bg overflow-hidden text-xs font-mono">
                <div className="border-b border-border px-4 py-2.5 text-muted-2 uppercase tracking-widest text-[0.6rem]">
                  {t("privacy.tableTitle")}
                </div>
                {[
                  { label: t("privacy.senderDomain"),    stored: true },
                  { label: t("privacy.recipientDomain"), stored: true },
                  { label: t("privacy.timestamp"),       stored: true },
                  { label: t("privacy.dkimHash"),        stored: true },
                  { label: t("privacy.subject"),         stored: false },
                  { label: t("privacy.bodyRow"),         stored: false },
                  { label: t("privacy.attachments"),     stored: false },
                  { label: t("privacy.names"),           stored: false },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-4 py-2.5 gap-3 ${
                      i < arr.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span className="text-muted truncate">{row.label}</span>
                    {row.stored ? (
                      <span className="text-verified shrink-0">✓</span>
                    ) : (
                      <span className="text-muted-2 shrink-0">{t("privacy.never")}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="border-t border-border bg-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <p className="text-base sm:text-lg text-txt font-semibold max-w-xl mx-auto leading-relaxed mb-8">
              {t("cta.built")}
            </p>
            <CopyableEmail variant="hero" />
            <p className="mt-4 text-xs text-muted-2 font-mono">
              {t("cta.sub")}
            </p>
          </div>
        </section>

      </main>

      <Footer />

    </div>
  );
}
