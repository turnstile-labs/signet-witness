import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Footer from "@/app/components/Footer";
import CopyableEmail from "@/app/components/CopyableEmail";
import NavBar from "@/app/components/NavBar";
import HeroBackdrop from "@/app/components/HeroBackdrop";
import DomainSearch from "@/app/components/DomainSearch";
import { sizeBadge } from "@/lib/badge-dimensions";
import { VERIFIED_INDEX } from "@/lib/scores";

export const revalidate = 300;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  // The seal-page mock below reuses seal.* copy verbatim instead of
  // maintaining a parallel home.mock.stats* branch — the whole point
  // of the mock is to render exactly what a real seal page renders,
  // so "literally the same strings" is the right contract. Means if
  // we ever revise seal copy (e.g. new trustLine), the mock tracks
  // automatically.
  const tSeal = await getTranslations("seal");

  // Mock numbers for the acmecorp.com preview seal. Tuned for the
  // "Building, on the way to Verified" state — what most first-
  // time visitors see on their own page for weeks or months. Reads
  // as honest ("here's where you'll be after a few months"), not
  // aspirational ("here's the finish line"), and pairs with the
  // signature-badge mock above (acme.studio, Verified) to tell a
  // two-persona story: one domain already verified and advertising
  // it in signatures, another on-record and building.
  const MOCK_DOMAIN = "acmecorp.com";
  const MOCK_TRUST = 58;
  const MOCK_EVENTS = 412;
  const MOCK_HISTORY = "9 mo";
  const MOCK_MUTUALS = 4;
  const MOCK_RECEIVERS = 18;
  const MOCK_DIVERSITY_PCT = 55;

  // Landing-page signature mock — Jane Doe @ Acme Studio. The badge
  // advertises acme.studio (matches the persona) and is rendered via
  // `?preview=verified` so the demo always shows the verified-green
  // pill without adding a fake row to the real registry. The mock
  // is *not* clickable: it's an illustration, not a real seal page.
  const DEMO_DOMAIN = "acme.studio";
  const demoBadge = sizeBadge(DEMO_DOMAIN);

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg text-txt">

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

            <p className="mt-5 text-xs text-muted-2">
              {t("orAutoLabel")}{" "}
              <Link
                href="/setup"
                className="font-semibold text-accent hover:text-accent-2 transition-colors"
              >
                {t("orAutoLink")}
              </Link>
            </p>
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
                  {/* Single asset — state color IS the badge identity.
                      Reads the same on any email-client bg (light or
                      dark), so no theme variance needed here or in the
                      route itself. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/badge/${DEMO_DOMAIN}.svg?preview=verified`}
                    alt={`Witnessed · ${DEMO_DOMAIN}`}
                    width={demoBadge.width}
                    height={demoBadge.height}
                    className="border-0 inline-block align-middle select-none"
                    draggable={false}
                  />
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

          {/* Mock seal-page card — structurally identical to the real
              /b/<domain> hero (same elements, same copy pulled verbatim
              from seal.*, same rhythm), but typography scaled ~one
              step down across the board and capped at max-w-xl so it
              reads as a preview card sitting alongside the landing's
              other surfaces, not a full-page hero. The real seal page
              stays at its own native scale — this is the "what your
              visitor will see" preview, deliberately smaller. */}
          <div className="max-w-xl mx-auto rounded-xl border border-border bg-surface px-5 sm:px-7 py-6 sm:py-8 shadow-sm">
            <p className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-2">
              {tSeal("eyebrow")}
            </p>

            <div className="mt-2.5">
              <h3 className="text-xl sm:text-2xl font-bold text-txt tracking-tight break-all leading-[1.1]">
                {MOCK_DOMAIN}
              </h3>
              <p className="text-[0.7rem] sm:text-xs text-muted-2 font-mono mt-1.5 break-all">
                witnessed.cc/b/{MOCK_DOMAIN}
              </p>
            </div>

            {/* State block — structurally identical to the real
                /b/<domain> StateBlock, scaled one step down to match
                the preview-card typography. Amber "Building" tone
                paired with the MOCK_TRUST subtitle so the preview
                tells the "building toward verified" story at a
                glance. If we ever add a fourth state or rename a
                label, the real page changes first and this mock
                follows via the seal.* keys. */}
            <div className="mt-5 rounded-xl border border-amber/40 bg-amber/10 px-4 py-4">
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className="shrink-0 w-8 h-8 rounded-full bg-amber flex items-center justify-center"
                >
                  <span className="w-2 h-2 rounded-full bg-bg" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold text-amber leading-none">
                    {tSeal("state.onRecordTitle")}
                  </p>
                  <p className="text-[0.7rem] sm:text-xs text-muted mt-1">
                    {tSeal("state.subtitleBuilding", {
                      index: MOCK_TRUST,
                      threshold: VERIFIED_INDEX,
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-6">
              {[
                { value: MOCK_EVENTS.toLocaleString(), label: tSeal("statVerifiedEmails"), sub: tSeal("statVerifiedEmailsSub") },
                { value: MOCK_HISTORY,                 label: tSeal("statActiveHistory"),  sub: tSeal("statActiveHistorySub")  },
                { value: MOCK_MUTUALS.toString(),      label: tSeal("statMutuals"),        sub: tSeal("statMutualsSub")        },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-xl sm:text-2xl font-bold font-mono leading-none text-txt">
                    {stat.value}
                  </p>
                  <p className="text-[0.7rem] sm:text-xs font-semibold text-txt mt-1.5">{stat.label}</p>
                  <p className="text-[0.6rem] sm:text-[0.7rem] text-muted-2 mt-0.5 leading-tight">{stat.sub}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[0.65rem] text-muted-2 leading-relaxed">
              {tSeal("scoreBasis", {
                receivers: MOCK_RECEIVERS,
                diversity: MOCK_DIVERSITY_PCT,
              })}
            </p>

            <p className="mt-6 text-[0.8rem] text-muted leading-relaxed">
              {tSeal("trustLine")}
            </p>
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
            <p className="mt-3 text-xs text-muted-2">
              {t("orAutoLabel")}{" "}
              <Link
                href="/setup"
                className="font-semibold text-accent hover:text-accent-2 transition-colors"
              >
                {t("orAutoLink")}
              </Link>
            </p>
          </div>
        </section>

      </main>

      <Footer />

    </div>
  );
}
