"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

// Owner-facing badge embed panel.
// Shows a live PNG preview (works everywhere SVG can be flaky),
// plus two clearly-labelled copy fields: a direct image URL for
// email clients, and an HTML snippet for websites.

export default function BadgeEmbed({ domain }: { domain: string }) {
  const t = useTranslations("badge");
  const origin = "https://witnessed.cc";
  const sealUrl = `${origin}/b/${domain}`;
  const imageUrl = `${origin}/badge/${domain}.png`;
  const htmlSnippet = `<a href="${sealUrl}"><img src="${imageUrl}" alt="Witnessed · ${domain}" width="360" height="40" style="border:0;display:inline-block;vertical-align:middle" /></a>`;

  return (
    <div className="space-y-5">

      <div>
        <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-2">
          {t("preview")}
        </p>
        <div className="bg-bg border border-border rounded-lg p-4 flex items-center justify-center overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/badge/${domain}.png`}
            alt={`Witnessed badge for ${domain}`}
            width={360}
            height={40}
            className="max-w-full h-auto"
          />
        </div>
      </div>

      <CopyField label={t("imageUrlLabel")} value={imageUrl} tCopy={t("copy")} tCopied={t("copied")} />

      <CopyField
        label={t("htmlLabel")}
        value={htmlSnippet}
        multiline
        tCopy={t("copy")}
        tCopied={t("copied")}
      />

      <details className="group">
        <summary className="cursor-pointer text-xs text-muted hover:text-txt transition-colors">
          {t("gmailQ")}
        </summary>
        <ol className="mt-3 text-xs text-muted leading-relaxed list-decimal pl-5 space-y-1">
          {(["s1", "s2", "s3", "s4", "s5"] as const).map((key) => (
            <li key={key}>
              {t.rich(`gmailSteps.${key}`, {
                url: sealUrl,
                b: (chunks: ReactNode) => (
                  <span className="text-txt">{chunks}</span>
                ),
                code: (chunks: ReactNode) => (
                  <code className="font-mono text-txt text-[0.7rem] break-all">
                    {chunks}
                  </code>
                ),
              })}
            </li>
          ))}
          <li>{t("gmailSteps.s6")}</li>
        </ol>
      </details>

    </div>
  );
}

function CopyField({
  value,
  label,
  multiline = false,
  tCopy,
  tCopied,
}: {
  value: string;
  label: string;
  multiline?: boolean;
  tCopy: string;
  tCopied: string;
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
    <div>
      <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-2 mb-2">
        {label}
      </p>
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
          aria-label={label}
        >
          {copied ? tCopied : tCopy}
        </button>
      </div>
    </div>
  );
}
