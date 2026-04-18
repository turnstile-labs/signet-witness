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
    console.error("[seal page error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <NavBar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
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
          {error.digest && (
            <p className="mt-8 text-[0.65rem] font-mono text-muted-2 break-all">
              ref: {error.digest}
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
