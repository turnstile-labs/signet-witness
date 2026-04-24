import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "termsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("termsPage");
  const tl = await getTranslations("legal");

  const useItems = t.raw("useItems") as string[];

  const inlineCode = (chunks: React.ReactNode) => (
    <code className="font-mono text-xs">{chunks}</code>
  );
  const pillCode = (chunks: React.ReactNode) => (
    <code className="font-mono text-txt text-xs bg-surface border border-border px-1.5 py-0.5 rounded">
      {chunks}
    </code>
  );

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <p className="text-xs text-muted-2 font-mono uppercase tracking-widest mb-3">
          {tl("eyebrow")}
        </p>
        <h1 className="text-3xl font-bold text-txt mb-2">{t("title")}</h1>
        <p className="text-sm text-muted mb-12">{tl("lastUpdated")}</p>

        <div className="space-y-10 text-sm text-muted leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("whatTitle")}
            </h2>
            <p>
              {t.rich("whatBody", {
                code: inlineCode,
                addr: pillCode,
              })}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("acceptanceTitle")}
            </h2>
            <p>{t("acceptanceBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("useTitle")}
            </h2>
            <p className="mb-3">{t("useIntro")}</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {useItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4">{t("useFoot")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("publicTitle")}
            </h2>
            <p>{t.rich("publicBody", { code: inlineCode })}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("provesTitle")}
            </h2>
            <p>{t("provesBody1")}</p>
            <p className="mt-3">{t("provesBody2")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("availabilityTitle")}
            </h2>
            <p>{t("availabilityBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("liabilityTitle")}
            </h2>
            <p>{t("liabilityBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("terminationTitle")}
            </h2>
            <p>{t("terminationBody1")}</p>
            <p className="mt-3">
              {t.rich("terminationBody2", {
                link: (chunks) => (
                  <Link
                    href="/privacy"
                    className="text-accent hover:text-accent-2 transition-colors"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("changesTitle")}
            </h2>
            <p>{t("changesBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
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
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
