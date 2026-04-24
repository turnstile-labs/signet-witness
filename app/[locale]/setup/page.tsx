import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";
import CopyableEmail from "@/app/components/CopyableEmail";
import InstallState from "@/app/components/InstallState";

// /setup — the one page that answers "how do I use this?".
//
// Every recipe here turns "remember to Bcc seal@witnessed.cc" into
// something that happens without user effort, scoped to the tool the
// user already has:
//
//   1. Chrome extension  — personal Gmail, one click
//   2. Google Workspace  — admin, one rule, entire org
//   3. Microsoft 365     — admin, one transport rule, entire org
//   4. Outlook desktop   — individual, local client rule
//   5. Manual BCC        — universal fallback, any provider
//
// Ordering is attention-first: the extension is the lowest-friction
// setup for the single largest audience (personal Gmail), so it leads.
// Admin recipes follow for teams that can act at the server level.
// Outlook desktop and Manual BCC cover everyone else, ending with the
// universal fallback.
//
// Hero mirrors the landing page (centered title + CopyableEmail hero
// button) so the primary visual — the accent-filled copy action — is
// consistent across the site.

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

  const extensionSteps = t.raw("extension.steps") as string[];
  const workspaceSteps = t.raw("workspace.steps") as string[];
  const m365Steps = t.raw("m365.steps") as string[];
  const outlookSteps = t.raw("outlook.steps") as string[];
  const manualSteps = t.raw("manual.steps") as string[];

  return (
    <div className="marketing flex flex-col min-h-screen bg-bg">
      <NavBar />

      <main className="flex-1">
        {/* ── Hero — centered, landing-page aesthetic ─────────────
             The address is the actual action on this page: every
             recipe below asks the user to paste it into some form.
             Giving it the same accent-filled hero button the landing
             uses keeps the visual language consistent and puts the
             copy action one reach from the moment they arrive. */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 sm:pb-12 text-center">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-4">
            {t("eyebrow")}
          </p>
          <h1 className="text-[2.25rem] sm:text-5xl font-bold tracking-tight text-txt leading-[1.05] mb-5">
            {t("title")}
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed mb-10">
            {t("intro")}
          </p>

          <CopyableEmail variant="hero" caption={t("copyCaption")} />
        </section>

        {/* ── Recipes — editorial, left-aligned ─────────────────── */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
          {/* ── Chrome extension (personal Gmail) ──────────────── */}
          <Recipe
            eyebrow={t("extension.eyebrow")}
            tag={t("bestFor")}
            tagBody={t("extension.bestFor")}
            action={
              <InstallState
                installedLabel={t("extension.installed")}
                installedSub={t("extension.installedSub")}
                installLabel={t("extension.install")}
                comingSoonLabel={t("extension.comingSoon")}
                comingSoonSub={t("extension.comingSoonSub")}
              />
            }
            steps={extensionSteps}
            outcome={t("extension.outcome")}
          />

          {/* ── Google Workspace admin ─────────────────────────── */}
          <Recipe
            eyebrow={t("workspace.eyebrow")}
            tag={t("bestFor")}
            tagBody={t("workspace.bestFor")}
            steps={workspaceSteps}
            outcome={t("workspace.outcome")}
          />

          {/* ── Microsoft 365 admin ────────────────────────────── */}
          <Recipe
            eyebrow={t("m365.eyebrow")}
            tag={t("bestFor")}
            tagBody={t("m365.bestFor")}
            steps={m365Steps}
            outcome={t("m365.outcome")}
          />

          {/* ── Outlook desktop (individual) ───────────────────── */}
          <Recipe
            eyebrow={t("outlook.eyebrow")}
            tag={t("bestFor")}
            tagBody={t("outlook.bestFor")}
            steps={outlookSteps}
            outcome={t("outlook.outcome")}
          />

          {/* ── Manual BCC (universal fallback) ────────────────── */}
          <Recipe
            eyebrow={t("manual.eyebrow")}
            tag={t("bestFor")}
            tagBody={t("manual.bestFor")}
            steps={manualSteps}
            outcome={t("manual.outcome")}
          />
        </div>
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

// A single provider recipe. Every recipe renders identically so a
// user scanning the page sees the same landmarks regardless of which
// path they take: eyebrow → best-for → optional action (e.g. install
// button) → numbered steps → outcome.
function Recipe({
  eyebrow,
  tag,
  tagBody,
  action,
  steps,
  outcome,
}: {
  eyebrow: string;
  tag: string;
  tagBody: string;
  action?: React.ReactNode;
  steps: string[];
  outcome: string;
}) {
  return (
    <section className="mt-12 pt-10 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
      <EyebrowLabel>{eyebrow}</EyebrowLabel>
      <p className="mt-3 text-sm text-muted leading-relaxed max-w-xl">
        <span className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mr-2">
          {tag}
        </span>
        {tagBody}
      </p>

      {action && <div className="mt-6 max-w-xl">{action}</div>}

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
