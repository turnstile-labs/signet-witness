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
  const t = await getTranslations({ locale, namespace: "privacyPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("privacyPage");
  const tl = await getTranslations("legal");

  const collectItems = t.raw("collectItems") as [string, string][];
  const neverItems = t.raw("neverItems") as string[];
  const useItems = t.raw("useItems") as string[];
  const rightsItems = t.raw("rightsItems") as [string, string][];
  const subProcessors = t.raw("subProcessors") as [string, string][];
  const basisItems = t.raw("basisItems") as [string, string][];

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
              {t("shortTitle")}
            </h2>
            <p>{t("shortBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("collectTitle")}
            </h2>
            <p className="mb-4">
              {t.rich("collectIntro", {
                addr: (chunks) => (
                  <code className="font-mono text-txt text-xs bg-surface border border-border px-1.5 py-0.5 rounded">
                    {chunks}
                  </code>
                ),
              })}
            </p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {collectItems.map(([label, desc]) => (
                <li key={label}>
                  <span className="text-txt font-medium">{label}</span> — {desc}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("neverTitle")}
            </h2>
            <p className="mb-4">{t("neverIntro")}</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {neverItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4">{t("neverFoot")}</p>
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
              {t("consentTitle")}
            </h2>
            <p>{t("consentBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("publicTitle")}
            </h2>
            <p>{t("publicBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("basisTitle")}
            </h2>
            <p className="mb-3">{t("basisIntro")}</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {basisItems.map(([label, desc]) => (
                <li key={label}>
                  <span className="text-txt font-medium">{label}</span> — {desc}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("rightsTitle")}
            </h2>
            <p className="mb-3">
              {t.rich("rightsIntro", {
                link: (chunks) => (
                  <Link
                    href="/rights"
                    className="text-accent hover:text-accent-2 transition-colors"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {rightsItems.map(([label, desc]) => (
                <li key={label}>
                  <span className="text-txt font-medium">{label}</span> — {desc}
                </li>
              ))}
            </ul>
            <p className="mt-4">{t("rightsFoot")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("retentionTitle")}
            </h2>
            <p>
              {t.rich("retentionBody", {
                link: (chunks) => (
                  <Link
                    href="/rights"
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
              {t("subProcessorsTitle")}
            </h2>
            <p className="mb-3">{t("subProcessorsIntro")}</p>
            <ul className="space-y-2 pl-4 border-l border-border">
              {subProcessors.map(([name, role]) => (
                <li key={name}>
                  <span className="text-txt font-medium">{name}</span> — {role}
                </li>
              ))}
            </ul>
            <p className="mt-4">{t("subProcessorsFoot")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("transfersTitle")}
            </h2>
            <p>{t("transfersBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("complaintTitle")}
            </h2>
            <p>{t("complaintBody")}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-txt mb-3">
              {t("infraTitle")}
            </h2>
            <p>{t("infraBody")}</p>
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
