"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Variant = "hero" | "compact";

export default function CopyableEmail({
  email = "sealed@witnessed.cc",
  variant = "hero",
  caption,
}: {
  email?: string;
  variant?: Variant;
  caption?: string;
}) {
  const t = useTranslations("copyableEmail");
  const [copied, setCopied] = useState(false);
  const captionText = caption ?? t("caption");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — fall through */
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:border-border-h transition-colors text-sm font-mono"
        aria-label={`${t("aria")} (${email})`}
      >
        <span className="text-accent">✦</span>
        <code className="text-txt">{email}</code>
        <span
          className={`ml-1 text-[0.65rem] uppercase tracking-widest transition-colors ${
            copied ? "text-verified" : "text-muted-2 group-hover:text-muted"
          }`}
        >
          {copied ? t("copied") : t("copy")}
        </span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-xs text-muted-2 uppercase tracking-widest font-mono mb-2 text-center">
        {captionText}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="group w-full flex items-center justify-between gap-3 pl-4 sm:pl-5 pr-2 py-2 rounded-xl border border-accent/30 bg-accent/5 hover:border-accent/60 hover:bg-accent/10 transition-all"
        aria-label={`${t("aria")} (${email})`}
      >
        <code className="text-sm sm:text-base font-mono font-semibold text-accent truncate min-w-0">
          {email}
        </code>
        <span
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
            copied
              ? "bg-verified/15 text-verified"
              : "bg-accent text-white group-hover:opacity-90"
          }`}
          style={copied ? undefined : { color: "#fff" }}
        >
          {copied ? t("copied") : t("copy")}
        </span>
      </button>
    </div>
  );
}
