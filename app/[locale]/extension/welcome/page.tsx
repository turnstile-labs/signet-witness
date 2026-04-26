import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

// /extension/welcome — the first-run tab that opens automatically after the
// user installs the Chrome extension. Kept deliberately short: confirm the
// install worked, tell them what just changed, give them three things to
// try, and explain how to turn off auto-seal if they ever want to.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "extensionWelcomePage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("extensionWelcomePage");
  const steps = t.raw("steps") as string[];
  const pinSteps = t.raw("pinSteps") as string[];

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-4">
            {t("eyebrow")}
          </p>
          <h1 className="text-[2.25rem] sm:text-5xl font-bold tracking-tight text-txt leading-[1.05] mb-5">
            {t("title")}
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed">
            {t("intro")}
          </p>
        </section>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
          <section className="mt-8">
            <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-3">
              {t("pinEyebrow")}
            </p>
            <p className="text-sm text-muted leading-relaxed max-w-xl mb-6">
              {t("pinIntro")}
            </p>

            <PuzzleDropdownMock hint={t("pinMockHint")} />

            <ol className="mt-6 space-y-3 text-sm text-txt leading-relaxed max-w-xl">
              {pinSteps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 font-mono text-muted-2 tabular-nums text-xs mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 max-w-xl">
              <p className="text-xs">
                <span className="font-semibold text-txt">
                  {t("pinReassureLabel")}
                </span>{" "}
                <span className="text-muted leading-relaxed">
                  {t("pinReassureBody")}
                </span>
              </p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-5">
              {t("stepsEyebrow")}
            </p>
            <ol className="space-y-3 text-sm text-txt leading-relaxed max-w-xl">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 font-mono text-muted-2 tabular-nums text-xs mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[0.7rem] text-muted-2 leading-relaxed max-w-xl">
              {t("openPopupHint")}
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-3">
              {t("toggleEyebrow")}
            </p>
            <p className="text-sm text-muted leading-relaxed max-w-xl">
              {t("toggleBody")}
            </p>
          </section>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
            >
              {t("goHome")}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// A miniature, stylized rendering of the Chrome puzzle-piece dropdown
// the user is about to open. We don't try to look pixel-identical to
// Chrome — we just want the user to scan this once, recognise the same
// shape when they actually click the puzzle, and know the pin icon is
// the thing to act on. Two cues do that work: a header with a puzzle
// glyph + "Extensions" label, and a single highlighted row showing
// Witnessed with the pin button outlined in our accent colour.
function PuzzleDropdownMock({ hint }: { hint: string }) {
  return (
    <figure className="max-w-xl">
      <figcaption className="text-[0.7rem] text-muted-2 mb-2 leading-relaxed">
        {hint}
      </figcaption>
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-bg">
          <PuzzleGlyph className="h-4 w-4 text-muted-2" />
          <span className="text-[0.7rem] font-mono uppercase tracking-widest text-muted-2">
            Extensions
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 border border-accent/30">
            <span className="font-brand text-[0.6rem] text-accent leading-none tracking-tight">
              W
            </span>
          </span>
          <span className="flex-1 text-sm font-semibold text-txt">
            Witnessed
          </span>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent text-accent ring-2 ring-accent/30 motion-safe:animate-pulse">
            <PinGlyph className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </figure>
  );
}

function PuzzleGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v3.8h1.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" />
    </svg>
  );
}

function PinGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 9V4h1V2H7v2h1v5l-2 2v2h5v7l1 1 1-1v-7h5v-2l-2-2z" />
    </svg>
  );
}
