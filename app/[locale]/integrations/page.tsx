import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

// /integrations — the single "how mail reaches us" page.
//
// The admin recipes live on /setup, the Chrome extension lives on
// /extension, and the manual Bcc lives on the landing page. This page
// is the index over all of them — the provider-neutral story in one
// URL, useful both for users shopping for the right path and for the
// Chrome Web Store listing's description, which can link here instead
// of claiming the extension is the only way in.

type Channel = {
  key:
    | "workspace"
    | "m365"
    | "outlook"
    | "gmailExt"
    | "manual"
    | "firefoxExt"
    | "thunderbird"
    | "outlookWeb";
  hasLink: boolean;
};

const LIVE: Channel[] = [
  { key: "workspace", hasLink: true },
  { key: "m365", hasLink: true },
  { key: "outlook", hasLink: true },
  { key: "gmailExt", hasLink: true },
  { key: "manual", hasLink: true },
];

const SOON: Channel[] = [
  { key: "firefoxExt", hasLink: false },
  { key: "thunderbird", hasLink: false },
  { key: "outlookWeb", hasLink: false },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "integrationsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("integrationsPage");

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 sm:pb-12 text-center">
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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-4">
            {t("liveEyebrow")}
          </p>
          <ul className="grid gap-3">
            {LIVE.map((c) => (
              <ChannelRow
                key={c.key}
                name={t(`channels.${c.key}.name`)}
                bestFor={t(`channels.${c.key}.bestFor`)}
                body={t(`channels.${c.key}.body`)}
                bestForLabel={t("adminBestFor")}
                linkLabel={
                  c.hasLink ? t(`channels.${c.key}.linkLabel`) : undefined
                }
                linkHref={
                  c.hasLink
                    ? (t(`channels.${c.key}.linkHref`) as
                        | "/"
                        | "/setup"
                        | "/extension")
                    : undefined
                }
              />
            ))}
          </ul>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mt-6 mb-4">
            {t("soonEyebrow")}
          </p>
          <ul className="grid gap-3">
            {SOON.map((c) => (
              <ChannelRow
                key={c.key}
                name={t(`channels.${c.key}.name`)}
                bestFor={t(`channels.${c.key}.bestFor`)}
                body={t(`channels.${c.key}.body`)}
                bestForLabel={t("adminBestFor")}
                faded
              />
            ))}
          </ul>

          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-lg sm:text-xl font-bold text-txt mb-3">
              {t("closingTitle")}
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-xl">
              {t("closingBody")}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ChannelRow({
  name,
  bestFor,
  bestForLabel,
  body,
  linkLabel,
  linkHref,
  faded = false,
}: {
  name: string;
  bestFor: string;
  bestForLabel: string;
  body: string;
  linkLabel?: string;
  linkHref?: "/" | "/setup" | "/extension";
  faded?: boolean;
}) {
  return (
    <li
      className={`rounded-xl border border-border bg-surface px-5 py-4 ${
        faded ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
        <h3 className="text-sm font-semibold text-txt">{name}</h3>
        <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
          {bestForLabel}: {bestFor}
        </p>
      </div>
      <p className="text-sm text-muted leading-relaxed max-w-xl">{body}</p>
      {linkLabel && linkHref ? (
        <Link
          href={linkHref}
          className="mt-3 inline-block text-sm font-semibold text-accent hover:text-accent-2 transition-colors"
        >
          {linkLabel}
        </Link>
      ) : null}
    </li>
  );
}
