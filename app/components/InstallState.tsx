"use client";

import { useEffect, useState } from "react";
import { CHROME_STORE_URL, EXTENSION_ID } from "@/lib/extension";

/**
 * Renders the install CTA for the Chrome extension. Has three visual states:
 *
 *   installed ✓      — the extension answered our PING
 *   install button   — extension not detected, store listing is live
 *   coming soon      — extension not detected, store listing not live yet
 *
 * Detection works via `chrome.runtime.sendMessage(EXTENSION_ID, { kind: "PING" })`.
 * The extension declares `externally_connectable.matches: ["https://witnessed.cc/*"]`
 * in its manifest, so only pages on our own origin can reach the handler.
 *
 * The probe never throws: if the user isn't on Chrome, or the extension isn't
 * installed, or we haven't configured EXTENSION_ID yet, we simply fall
 * through to the not-installed view.
 *
 * All five copy strings are passed in from the caller so this component
 * stays namespace-agnostic — it currently lives inside /setup's extension
 * recipe but could be dropped into any page with a set of labels.
 */
export default function InstallState({
  installedLabel,
  installedSub,
  installLabel,
  comingSoonLabel,
  comingSoonSub,
}: {
  installedLabel: string;
  installedSub: string;
  installLabel: string;
  comingSoonLabel: string;
  comingSoonSub: string;
}) {
  const [state, setState] = useState<"unknown" | "installed" | "absent">(
    "unknown",
  );

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (!EXTENSION_ID) {
        if (!cancelled) setState("absent");
        return;
      }
      const chromeRuntime = (
        globalThis as unknown as {
          chrome?: {
            runtime?: {
              sendMessage?: (
                id: string,
                msg: unknown,
                cb: (reply: unknown) => void,
              ) => void;
              lastError?: unknown;
            };
          };
        }
      ).chrome?.runtime;

      if (!chromeRuntime?.sendMessage) {
        if (!cancelled) setState("absent");
        return;
      }
      try {
        chromeRuntime.sendMessage(
          EXTENSION_ID,
          { kind: "PING" },
          (reply: unknown) => {
            if (cancelled) return;
            if (
              reply &&
              typeof reply === "object" &&
              (reply as { installed?: boolean }).installed
            ) {
              setState("installed");
            } else {
              setState("absent");
            }
          },
        );
      } catch {
        if (!cancelled) setState("absent");
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "installed") {
    return (
      <div
        className="rounded-xl border border-verified/40 bg-verified/10 px-5 py-4"
        role="status"
      >
        <p className="text-sm font-semibold text-verified">{installedLabel}</p>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          {installedSub}
        </p>
      </div>
    );
  }

  if (state === "absent" && CHROME_STORE_URL) {
    return (
      <a
        href={CHROME_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-opacity"
      >
        {installLabel}
      </a>
    );
  }

  if (state === "absent") {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-4">
        <p className="text-sm font-semibold text-txt">{comingSoonLabel}</p>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          {comingSoonSub}
        </p>
      </div>
    );
  }

  // Unknown — render an invisible placeholder with the same height as the
  // CTA so the layout doesn't jump when the probe resolves.
  return <div aria-hidden className="h-[3.5rem]" />;
}
