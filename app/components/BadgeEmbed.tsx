"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";

// Owner-facing badge embed panel with a light/dark toggle.
// Copy either the image URL (paste into any email signature, directly
// in Gmail, Apple Mail, Outlook) or the full HTML snippet (for websites
// and invoice footers).

export default function BadgeEmbed({ domain }: { domain: string }) {
  const t = useTranslations("badge");
  const [theme, setTheme] = useState<Theme>("dark");

  const origin = "https://witnessed.cc";
  const themeParam = theme === "light" ? "?theme=light" : "";
  const sealUrl = `${origin}/b/${domain}`;
  const imageUrl = `${origin}/badge/${domain}.png${themeParam}`;
  const previewSrc = `/badge/${domain}.png${themeParam}`;
  const htmlSnippet = `<a href="${sealUrl}"><img src="${imageUrl}" alt="Witnessed · ${domain}" width="360" height="40" style="border:0;display:inline-block;vertical-align:middle" /></a>`;

  return (
    <div className="space-y-5">

      <div>
        <div className="flex items-center justify-between mb-2 gap-3">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
            {t("preview")}
          </p>
          <ThemeToggle theme={theme} setTheme={setTheme} darkLabel={t("dark")} lightLabel={t("light")} />
        </div>
        <div
          className={`border rounded-lg p-4 flex items-center justify-center overflow-x-auto transition-colors ${
            theme === "dark"
              ? "bg-[#0c0c0f] border-[#25252f]"
              : "bg-white border-[#e0e0ec]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={`Witnessed badge for ${domain}`}
            width={360}
            height={40}
            className="max-w-full h-auto"
          />
        </div>
      </div>

      <CopyField
        label={t("imageUrlLabel")}
        value={imageUrl}
        tCopy={t("copy")}
        tCopied={t("copied")}
      />

      <CopyField
        label={t("htmlLabel")}
        value={htmlSnippet}
        multiline
        tCopy={t("copy")}
        tCopied={t("copied")}
      />

    </div>
  );
}

function ThemeToggle({
  theme,
  setTheme,
  darkLabel,
  lightLabel,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  darkLabel: string;
  lightLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Badge theme"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-bg"
    >
      <ThemeButton
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
        label={darkLabel}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </ThemeButton>
      <ThemeButton
        active={theme === "light"}
        onClick={() => setTheme("light")}
        label={lightLabel}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4.5" />
          <line x1="12" y1="1.5" x2="12" y2="3.5" />
          <line x1="12" y1="20.5" x2="12" y2="22.5" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1.5" y1="12" x2="3.5" y2="12" />
          <line x1="20.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </ThemeButton>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 h-6 rounded text-[0.65rem] uppercase tracking-widest font-mono transition-colors ${
        active
          ? "bg-surface-2 text-txt"
          : "text-muted-2 hover:text-muted"
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function CopyField({
  value,
  label,
  multiline = false,
  tCopy,
  tCopied,
}: {
  value: string;
  label: string;
  multiline?: boolean;
  tCopy: string;
  tCopied: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-2">
        {label}
      </p>
      <div className="flex items-stretch gap-2">
        <div
          className={`flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted ${
            multiline
              ? "whitespace-pre overflow-x-auto thin-scrollbar"
              : "truncate"
          }`}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`shrink-0 px-3 rounded-lg text-xs font-semibold tracking-wide transition-colors border ${
            copied
              ? "bg-verified/15 text-verified border-verified/30"
              : "bg-surface border-border text-txt hover:border-border-h"
          }`}
          aria-label={label}
        >
          {copied ? tCopied : tCopy}
        </button>
      </div>
    </div>
  );
}
