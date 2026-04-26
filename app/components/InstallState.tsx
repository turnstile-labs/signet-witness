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
      <div className="flex justify-center">
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2.5 pl-2 pr-5 py-2 rounded-xl bg-accent text-white text-sm font-semibold tracking-wide hover:opacity-90 transition-opacity"
        >
          <ChromeLogo />
          {installLabel}
        </a>
      </div>
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

// Multicolor Chrome logo. Sits on a white pill so the brand colors
// read cleanly against any button background, the same pattern Google
// uses on its own promotional "Get it on Chrome" buttons.
function ChromeLogo() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white">
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M12 3a9 9 0 0 0-7.794 4.5l4.45 7.7A4.5 4.5 0 0 1 12 7.5h7.794A9 9 0 0 0 12 3z"
        />
        <path
          fill="#FBBC04"
          d="M19.794 7.5H12a4.5 4.5 0 0 1 3.897 6.75L11.41 21.96A9 9 0 0 0 19.794 7.5z"
        />
        <path
          fill="#34A853"
          d="M4.206 7.5A9 9 0 0 0 11.41 21.96l4.487-7.71A4.5 4.5 0 0 1 12 16.5a4.5 4.5 0 0 1-4.247-3.06L4.206 7.5z"
        />
        <circle cx="12" cy="12" r="3.6" fill="#4285F4" />
      </svg>
    </span>
  );
}
