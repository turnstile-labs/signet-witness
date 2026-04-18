"use client";

import { useEffect } from "react";
import NavBar from "@/app/components/NavBar";
import Footer from "@/app/components/Footer";

export default function SealError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[seal page error]", error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-xs font-mono text-muted-2 uppercase tracking-widest mb-4">
            Something went wrong
          </p>
          <p className="text-sm text-muted leading-relaxed mb-6">
            We couldn&apos;t load this seal page. The record may be temporarily
            unavailable.
          </p>
          <button
            onClick={reset}
            className="text-xs font-mono text-accent hover:underline"
          >
            Try again →
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
