"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useEffect, useRef, useState, useTransition } from "react";

// Custom popover instead of a native <select>. On mobile the native
// picker takes over the full screen as a wheel/sheet — fine for long
// option lists, overkill for two two-letter locale codes. The custom
// version stays compact (~5rem wide), anchors to the right edge of
// the trigger, and matches the rest of the navbar's styling instead
// of inheriting the OS theme.
export default function LanguageSwitcher() {
  const t = useTranslations("languageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function selectLocale(next: string) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 bg-surface border border-border rounded-md text-xs font-mono text-muted py-1 pl-2 pr-1.5 hover:border-border-h focus:outline-none focus:border-border-h transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >
        <span>{locale.toUpperCase()}</span>
        <span aria-hidden className="text-muted-2 text-[0.6rem]">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 top-full mt-1 min-w-[4.5rem] rounded-md border border-border bg-surface shadow-lg overflow-hidden z-50"
        >
          {routing.locales.map((loc) => {
            const active = loc === locale;
            return (
              <li key={loc} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => selectLocale(loc)}
                  className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors cursor-pointer ${
                    active
                      ? "bg-bg text-txt"
                      : "text-muted hover:bg-bg hover:text-txt"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
