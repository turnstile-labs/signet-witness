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

  // Mock numbers for the acmecorp.com preview seal. Tuned so the mock
  // reads as a "mature, verified, but not a suspicious 100" sender:
  //   - trust 72  → above the 65 verified threshold with visible
  //     headroom on the bar, bar color = verified green
  //   - 847 events + 14mo history + 7 mutuals → plausible sustained
  //     use without looking like a superpower
  //   - 24 counterparties + 60 diversity → scoreBasis reads "Based
  //     on 24 distinct counterparties · diversity 60 / 100"
  const MOCK_DOMAIN = "acmecorp.com";
  const MOCK_TRUST = 72;
  const MOCK_EVENTS = 847;
  const MOCK_HISTORY = "14 mo";
  const MOCK_MUTUALS = 7;
  const MOCK_RECEIVERS = 24;
  const MOCK_DIVERSITY_PCT = 60;

  // Landing-page signature mock — Jane Doe @ Acme Studio. The badge
  // advertises acme.studio (matches the persona) and is rendered via
  // `?preview=verified&t=78` so the demo always looks attractive
  // without adding a fake row to the real registry, AND reads as a
  // plausible real score (earned, not a suspicious-looking 100/100).
  // 78 sits comfortably above the 65 verified threshold and above
  // the seal-page mock below (72), so the two personas tell a
  // "different firms, both verified, different histories" story.
  // The mock is *not* clickable: this is an illustration, not a
  // real seal page.
  const DEMO_DOMAIN = "acme.studio";
  const DEMO_TRUST = 78;
  const demoBadge = sizeBadge(DEMO_DOMAIN);

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/badge/${DEMO_DOMAIN}.svg?preview=verified&t=${DEMO_TRUST}`}
                    alt={`Witnessed · ${DEMO_DOMAIN}`}
                    width={demoBadge.width}
                    height={demoBadge.height}
                    className="border-0 inline-block align-middle light:hidden select-none"
                    draggable={false}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/badge/${DEMO_DOMAIN}.svg?preview=verified&t=${DEMO_TRUST}&theme=light`}
                    alt={`Witnessed · ${DEMO_DOMAIN}`}
                    width={demoBadge.width}
                    height={demoBadge.height}
                    className="border-0 hidden align-middle light:inline-block select-none"
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

          {/* Mock seal-page card — a 1:1 replica of the real
              /b/<domain> hero section, wrapped in a rounded surface
              so visitors read it as "here's what you'll see when
              someone clicks your badge." Every piece of copy inside
              the card comes from the seal.* namespace directly, so
              the mock can't drift from the real page's wording. */}
          <div className="rounded-xl border border-border bg-surface px-6 sm:px-10 py-8 sm:py-10 shadow-sm">
            {/* Eyebrow */}
            <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
              {tSeal("eyebrow")}
            </p>

            {/* Domain + permalink — matches seal page's H1 / perma
                treatment (smaller sizes than the real seal's 3xl/5xl
                since the mock sits inside a card rather than as the
                whole page, but same proportional rhythm). */}
            <div className="mt-3">
              <h3 className="text-2xl sm:text-4xl font-bold text-txt tracking-tight break-all leading-[1.05]">
                {MOCK_DOMAIN}
              </h3>
              <p className="text-xs sm:text-sm text-muted-2 font-mono mt-2 break-all">
                witnessed.cc/b/{MOCK_DOMAIN}
              </p>
            </div>

            {/* Trust-index hero — same composition as seal.tsx's
                TrustIndexHero: big number left, uppercase scale right,
                label under the number, bar with a tick at the verified
                threshold. Sized one notch smaller than the real seal
                so it fits the card's narrower column comfortably. */}
            <div className="mt-8">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-4xl sm:text-5xl font-bold font-mono leading-none tabular-nums text-txt">
                    {MOCK_TRUST}
                    <span className="text-xl sm:text-2xl text-muted-2 ml-1">
                      / 100
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-txt mt-2">
                    {tSeal("trustIndexLabel")}
                  </p>
                </div>
                <p className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-2 shrink-0">
                  {tSeal("trustIndexScale")}
                </p>
              </div>
              <div className="relative mt-3 h-1.5 rounded-full bg-bg border border-border overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-verified"
                  style={{ width: `${MOCK_TRUST}%` }}
                />
                <div
                  className="absolute top-0 h-full w-px bg-verified/60"
                  style={{ left: `${VERIFIED_INDEX}%` }}
                />
              </div>
            </div>

            {/* Stats — three values matching the seal page's Stat
                component: 3xl/4xl value, xs/sm label, 0.65rem/xs sub. */}
            <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-10">
              {[
                { value: MOCK_EVENTS.toLocaleString(), label: tSeal("statVerifiedEmails"), sub: tSeal("statVerifiedEmailsSub") },
                { value: MOCK_HISTORY,                 label: tSeal("statActiveHistory"),  sub: tSeal("statActiveHistorySub")  },
                { value: MOCK_MUTUALS.toString(),      label: tSeal("statMutuals"),        sub: tSeal("statMutualsSub")        },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl sm:text-4xl font-bold font-mono leading-none text-txt">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-txt mt-2">{stat.label}</p>
                  <p className="text-[0.65rem] sm:text-xs text-muted-2 mt-0.5 leading-tight">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* scoreBasis meta line — quiet, 0.7rem, explains what the
                trust number is built on. Same rendering as seal.tsx. */}
            <p className="mt-6 text-[0.7rem] text-muted-2 leading-relaxed max-w-xl">
              {tSeal("scoreBasis", {
                receivers: MOCK_RECEIVERS,
                diversity: MOCK_DIVERSITY_PCT,
              })}
            </p>

            {/* trustLine — the same one-liner the real seal page
                closes its hero with. Sits at the emotional bottom of
                the preview: "this is a forward-only record, each
                entry verified at the moment of sending." */}
            <p className="mt-10 text-sm text-muted leading-relaxed max-w-xl">
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
