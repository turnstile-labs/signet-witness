import Link from "next/link";
import CopyableEmail from "./CopyableEmail";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

        <div className="flex flex-col sm:flex-row gap-8 sm:items-start sm:justify-between">

          <div className="max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-semibold text-sm tracking-tight mb-3"
            >
              <span className="text-accent text-base">✦</span>
              <span className="text-txt">Witnessed</span>
            </Link>
            <p className="text-sm text-muted leading-relaxed mb-4">
              The verifiable record of every business email you send —
              built automatically, impossible to backdate.
            </p>
            <CopyableEmail variant="compact" />
          </div>

          <div className="flex gap-10 sm:gap-14 text-sm">
            <div className="flex flex-col gap-2.5">
              <span className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-1">
                Product
              </span>
              <Link href="/" className="text-muted hover:text-txt transition-colors">
                Home
              </Link>
              <Link href="/b/witnessed.cc" className="text-muted hover:text-txt transition-colors">
                Live example
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-1">
                Legal
              </span>
              <Link href="/privacy" className="text-muted hover:text-txt transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted hover:text-txt transition-colors">
                Terms
              </Link>
            </div>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-border">
          <p className="text-xs text-muted-2 font-mono">
            © {year} Witnessed · Seal pages are free, forever.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse inline-block" />
            All systems operational
          </div>
        </div>

      </div>
    </footer>
  );
}
