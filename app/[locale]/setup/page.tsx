import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import CopyableEmail from "@/app/components/CopyableEmail";

// /setup — the one-time-configuration page.
//
// Single job: turn "remember to CC seal@witnessed.cc" into "happens
// automatically on every outbound email." Every recipe below is
// self-serve — the user copies an address and a few settings into
// their own mail provider. No account, no extension, no partnership.
//
// Editorial rhythm matches the rest of the site: eyebrow → artifact →
// one plain sentence. Each provider gets its own section separated by
// a thin divider. No accordions, no tabs — users scroll to theirs.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "setupPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("setupPage");

  const workspaceSteps = t.raw("workspace.steps") as string[];
  const m365Steps = t.raw("m365.steps") as string[];
  const outlookSteps = t.raw("outlook.steps") as string[];

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section>
          <EyebrowLabel>{t("eyebrow")}</EyebrowLabel>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-txt tracking-tight leading-[1.05]">
            {t("title")}
          </h1>
          <p className="mt-4 text-base text-muted leading-relaxed max-w-xl">
            {t("intro")}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/50 text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
            {t("addressLabel")}
            <code className="ml-1 normal-case tracking-normal text-txt">
              seal@witnessed.cc
            </code>
          </div>
        </section>

        {/* ── Google Workspace admin ───────────────────────────── */}
        <Recipe
          eyebrow={t("workspace.eyebrow")}
          tag={t("bestFor")}
          tagBody={t("workspace.bestFor")}
          steps={workspaceSteps}
          outcome={t("workspace.outcome")}
        />

        {/* ── Microsoft 365 admin ──────────────────────────────── */}
        <Recipe
          eyebrow={t("m365.eyebrow")}
          tag={t("bestFor")}
          tagBody={t("m365.bestFor")}
          steps={m365Steps}
          outcome={t("m365.outcome")}
        />

        {/* ── Outlook desktop (individual) ─────────────────────── */}
        <Recipe
          eyebrow={t("outlook.eyebrow")}
          tag={t("bestFor")}
          tagBody={t("outlook.bestFor")}
          steps={outlookSteps}
          outcome={t("outlook.outcome")}
        />

        {/* ── Everyone else — manual fallback ──────────────────── */}
        <section className="mt-12 pt-10 border-t border-border">
          <EyebrowLabel>{t("everyoneElse.eyebrow")}</EyebrowLabel>
          <p className="mt-3 text-sm text-muted leading-relaxed max-w-xl">
            {t("everyoneElse.body")}
          </p>
          <div className="mt-6">
            <CopyableEmail variant="compact" />
          </div>
          <p className="mt-6 text-[0.7rem] text-muted-2 leading-relaxed max-w-xl">
            {t("everyoneElse.outcome")}
          </p>
        </section>

        {/* ── What happens next ────────────────────────────────── */}
        <section className="mt-12 pt-10 border-t border-border">
          <EyebrowLabel>{t("afterTitle")}</EyebrowLabel>
          <p className="mt-3 text-sm text-muted leading-relaxed max-w-xl">
            {t.rich("afterBody", {
              u: (chunks) => (
                <span className="font-mono text-txt">{chunks}</span>
              ),
            })}
          </p>
          <Link
            href="/rights"
            className="mt-5 inline-block text-xs font-semibold text-accent hover:text-accent-2 transition-colors"
          >
            {t("rightsLink")}
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
      {children}
    </p>
  );
}

// A single provider recipe. Each one renders identically so a user
// scanning the page sees the same landmarks (intro → numbered steps
// → outcome) regardless of which provider they actually use.
function Recipe({
  eyebrow,
  tag,
  tagBody,
  steps,
  outcome,
}: {
  eyebrow: string;
  tag: string;
  tagBody: string;
  steps: string[];
  outcome: string;
}) {
  return (
    <section className="mt-12 pt-10 border-t border-border">
      <EyebrowLabel>{eyebrow}</EyebrowLabel>
      <p className="mt-3 text-sm text-muted leading-relaxed max-w-xl">
        <span className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mr-2">
          {tag}
        </span>
        {tagBody}
      </p>

      <ol className="mt-6 space-y-3 text-sm text-txt leading-relaxed max-w-xl">
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
        {outcome}
      </p>
    </section>
  );
}
