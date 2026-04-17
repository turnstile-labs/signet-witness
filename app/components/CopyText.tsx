"use client";

import { useState } from "react";

export default function CopyText({
  value,
  label,
  multiline = false,
}: {
  value: string;
  label?: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="w-full">
      {label && (
        <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-2">
          {label}
        </p>
      )}
      <div className="flex items-stretch gap-2">
        <div
          className={`flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted ${
            multiline ? "whitespace-pre overflow-x-auto" : "truncate"
          }`}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`shrink-0 px-3 rounded-lg text-xs font-semibold tracking-wide transition-colors border ${
            copied
              ? "bg-verified/15 text-verified border-verified/30"
              : "bg-surface border-border text-txt hover:border-border-h"
          }`}
          aria-label={`Copy ${label ?? "to clipboard"}`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
