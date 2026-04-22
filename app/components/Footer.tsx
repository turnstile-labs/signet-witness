import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-2 font-mono">
        <p>© {new Date().getFullYear()} Witnessed</p>
        <nav className="flex items-center gap-5">
          <Link href="/setup" className="hover:text-muted transition-colors">
            {t("setup")}
          </Link>
          <Link href="/privacy" className="hover:text-muted transition-colors">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-muted transition-colors">
            {t("terms")}
          </Link>
          <Link href="/rights" className="hover:text-muted transition-colors">
            {t("rights")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
