"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";

// Owner-facing badge embed panel. One job: get a *clickable* badge
// onto the clipboard so the user can paste it into their email
// signature (Gmail, Apple Mail, Outlook) and distribute it at scale.
//
// Rich-text copy via navigator.clipboard.write([ClipboardItem]) is
// what makes this work — Gmail's signature editor is WYSIWYG and
// only preserves formatting from the clipboard's text/html entry.

export default function BadgeEmbed({ domain }: { domain: string }) {
  const t = useTranslations("badge");
  const [theme, setTheme] = useState<Theme>("dark");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const origin = "https://witnessed.cc";
  const themeParam = theme === "light" ? "?theme=light" : "";
  const sealUrl = `${origin}/b/${domain}`;
  const imageUrl = `${origin}/badge/${domain}.png${themeParam}`;
  const previewSrc = `/badge/${domain}.png${themeParam}`;
  const html = `<a href="${sealUrl}"><img src="${imageUrl}" alt="Witnessed · ${domain}" width="260" height="26" style="border:0;display:inline-block;vertical-align:middle" /></a>`;

  async function handleCopy() {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([sealUrl], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2 gap-3">
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
            {t("preview")}
          </p>
          <ThemeToggle
            theme={theme}
            setTheme={setTheme}
            darkLabel={t("dark")}
            lightLabel={t("light")}
            ariaLabel={t("themeAria")}
          />
        </div>
        <div
          className={`border rounded-lg p-4 flex items-center justify-center overflow-x-auto transition-colors ${
            theme === "dark"
              ? "bg-[#0c0c0f] border-[#25252f]"
              : "bg-white border-[#e0e0ec]"
          }`}
        >
          <a
            href={sealUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={t("alt", { domain })}
              width={260}
              height={26}
              className="max-w-full h-auto block"
            />
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`w-full h-11 rounded-lg text-sm font-semibold tracking-wide transition-opacity border ${
          status === "copied"
            ? "bg-verified/15 text-verified border-verified/30"
            : status === "error"
              ? "bg-red-500/15 text-red-400 border-red-500/30"
              : "bg-accent text-white border-accent hover:opacity-90"
        }`}
      >
        {status === "copied"
          ? t("copyDone")
          : status === "error"
            ? t("copyError")
            : t("copyBadge")}
      </button>

      <p className="text-[0.7rem] text-muted-2 leading-relaxed">
        {t("howTo")}
      </p>
    </div>
  );
}

function ThemeToggle({
  theme,
  setTheme,
  darkLabel,
  lightLabel,
  ariaLabel,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  darkLabel: string;
  lightLabel: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
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
