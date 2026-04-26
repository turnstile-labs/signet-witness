"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const t = useTranslations("navAria");
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex items-center gap-2 select-none"
        >
          <Image
            src="/icon.png"
            alt=""
            width={20}
            height={20}
            priority
            className="rounded-[5px]"
          />
          <span className="flex items-baseline gap-0">
            <span className="font-brand text-txt text-sm">WITNESSED</span>
            <span className="font-mono text-[0.6rem] text-brand font-normal tracking-tight leading-none relative top-px">.cc</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
