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
