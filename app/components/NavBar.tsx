"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

export default function NavBar({
  variant = "landing",
}: {
  variant?: "landing" | "seal";
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const domain = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
    if (!domain) return;
    router.push(`/b/${encodeURIComponent(domain)}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">

        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-sm tracking-tight shrink-0"
        >
          <span className="text-accent text-base">✦</span>
          <span className="text-txt">Witnessed</span>
        </Link>

        <span className="hidden md:inline text-[0.65rem] font-mono uppercase tracking-widest text-muted-2">
          {variant === "seal" ? t("eyebrow") : t("eyebrow")}
        </span>

        <form
          onSubmit={handleSubmit}
          className="ml-auto flex items-center gap-1.5 bg-surface border border-border rounded-lg pl-2.5 pr-1 py-1 focus-within:border-border-h transition-colors min-w-0"
        >
          <span className="text-muted-2 text-xs hidden sm:inline">⌕</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label={t("searchAria")}
            className="bg-transparent outline-none text-xs sm:text-sm font-mono text-txt placeholder:text-muted-2 w-24 sm:w-40 min-w-0"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label={t("lookupAria")}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-accent disabled:text-muted-2 disabled:cursor-not-allowed enabled:hover:bg-accent/10 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path
                d="M1 5h7.5M5.5 2l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
