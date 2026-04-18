"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useTransition } from "react";

export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor="language-switcher">
        {t("label")}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={onChange}
        disabled={isPending}
        className="appearance-none bg-surface border border-border rounded-md text-xs font-mono text-muted py-1 pl-2 pr-6 hover:border-border-h focus:outline-none focus:border-border-h transition-colors cursor-pointer"
        aria-label={t("label")}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc} className="bg-bg text-txt">
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-2 text-[0.6rem]"
        aria-hidden
      >
        ▾
      </span>
    </div>
  );
}
