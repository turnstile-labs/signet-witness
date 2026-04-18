"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

export default function NavBar() {
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">

        <Link
          href="/"
          className="font-brand text-txt text-sm sm:text-base shrink-0"
          aria-label="Witnessed"
        >
          Witnessed
        </Link>

        <form
          onSubmit={handleSubmit}
          className="ml-auto flex items-center bg-surface border border-border rounded-lg px-2.5 h-8 focus-within:border-border-h transition-colors min-w-0"
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label={t("searchAria")}
            className="bg-transparent outline-none text-xs sm:text-sm font-mono text-txt placeholder:text-muted-2 w-32 sm:w-48 min-w-0"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label={t("lookupAria")}
            className="shrink-0 flex items-center justify-center ml-1 -mr-0.5 w-6 h-6 rounded-md text-accent disabled:text-muted-2 disabled:cursor-not-allowed enabled:hover:bg-accent/10 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M1 6h9M6.5 2.5l3.5 3.5-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

      </div>
    </header>
  );
}
