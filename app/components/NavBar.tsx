import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center">
        <Link href="/" aria-label="Witnessed" className="flex items-baseline gap-0 select-none">
          <span className="font-brand text-txt text-sm">WITNESSED</span>
          <span className="font-mono text-[0.6rem] text-accent font-normal tracking-tight leading-none relative top-px">.cc</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
