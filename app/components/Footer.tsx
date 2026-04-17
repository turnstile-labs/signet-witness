import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">

        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="text-accent">✦</span>
          <span>Witnessed</span>
          <span className="text-muted-2">·</span>
          <span className="text-xs text-muted-2">© {new Date().getFullYear()}</span>
        </div>

        <nav className="flex items-center gap-4 text-xs text-muted-2">
          <Link href="/privacy" className="hover:text-muted transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-muted transition-colors">Terms</Link>
          <a href="mailto:hello@witnessed.cc" className="hover:text-muted transition-colors">Contact</a>
        </nav>

      </div>
    </footer>
  );
}
