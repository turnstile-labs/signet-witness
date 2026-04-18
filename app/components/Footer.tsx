import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-2 font-mono">
        <p>© {new Date().getFullYear()} Witnessed</p>
        <div className="flex items-center gap-4 sm:gap-5">
          <Link href="/privacy" className="hover:text-muted transition-colors">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-muted transition-colors">
            {t("terms")}
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
