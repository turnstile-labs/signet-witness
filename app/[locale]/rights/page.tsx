import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import RightsForm from "@/app/components/RightsForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rightsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RightsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("rightsPage");
  const tl = await getTranslations("legal");

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">
          {tl("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold text-txt mb-2">{t("title")}</h1>
        <p className="text-sm text-muted mb-8 leading-relaxed">{t("lede")}</p>

        <RightsForm />

        <section className="mt-16 space-y-6 text-sm text-muted leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-txt mb-2">
              {t("whyTxtTitle")}
            </h2>
            <p>{t("whyTxtBody")}</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-txt mb-2">
              {t("timingTitle")}
            </h2>
            <p>{t("timingBody")}</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-txt mb-2">
              {t("scopeTitle")}
            </h2>
            <p>{t("scopeBody")}</p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-txt mb-2">
              {t("contactTitle")}
            </h2>
            <p>
              {t("contactIntro")}{" "}
              <a
                href="mailto:hello@witnessed.cc"
                className="text-accent hover:text-accent-2 transition-colors"
              >
                hello@witnessed.cc
              </a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
