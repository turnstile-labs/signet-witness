"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { sizeBadge } from "@/lib/badge-dimensions";
import { useSiteTheme } from "@/app/components/useSiteTheme";

// Owner-facing badge surface on the seal page. Visually mirrors the
// landing's badge section so what you preview is what gets pasted.
// One job: get a *clickable* badge onto the clipboard so the owner
// can paste it into their email signature (Gmail, Apple Mail, Outlook).
//
// Theme handling is split between the preview and the clipboard:
//
//   Preview — both variants are rendered as stacked <img> tags and
//             the active one is picked by CSS via the `light:`
//             Tailwind variant (which selects on `html.light`). The
//             no-flash inline script flips that class before first
//             paint, so the right variant is visible from frame zero.
//             No JS swap, no hydration flicker on reload.
//   Copy   — the clipboard payload is a single <img src=…> URL, so
//             it has to commit to one theme. We use the JS-tracked
//             site theme (`useSiteTheme`) to pick which variant goes
//             into the clipboard, so what owners see in the preview
//             is exactly what they paste.
//
// Rich-text copy via clipboard.write is what makes the paste work:
// Gmail's signature editor is WYSIWYG and only preserves formatting
// from the clipboard's text/html entry.

export default function BadgeEmbed({ domain }: { domain: string }) {
  const t = useTranslations("badge");
  const theme = useSiteTheme();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const origin = "https://witnessed.cc";
  const sealUrl = `${origin}/b/${domain}`;
  const darkPreviewSrc = `/badge/${domain}.png?theme=dark`;
  const lightPreviewSrc = `/badge/${domain}.png?theme=light`;
  const imageUrl = `${origin}/badge/${domain}.png?theme=${theme}`;
  // Width adapts to the domain so the copied <img> advertises the same
  // dimensions as the PNG we render. Height is fixed.
  //
  // We ship dimensions both as HTML attributes AND as inline CSS. Gmail's
  // signature editor strips `width`/`height` attributes during the paste
  // roundtrip (clipboard → rich-text editor → server), which leaves the
  // <img> to fall back to its intrinsic pixel size — and our PNG is
  // rendered at 2× retina density, so without the hint it displays at
  // exactly twice the intended size (this is the "why is the badge huge
  // in my signature?" bug). Inline styles survive the sanitizer.
  const { width: badgeW, height: badgeH } = sizeBadge(domain);
  const imgStyle = `border:0;display:inline-block;vertical-align:middle;width:${badgeW}px;height:${badgeH}px;max-width:${badgeW}px`;
  const html = `<a href="${sealUrl}"><img src="${imageUrl}" alt="Witnessed · ${domain}" width="${badgeW}" height="${badgeH}" style="${imgStyle}" /></a>`;

  async function handleCopy() {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([sealUrl], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const previewAlt = t("alt", { domain });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border text-[0.6rem] font-mono uppercase tracking-widest text-muted-2">
          {t("mockLabel")}
        </div>
        <div className="px-5 py-5">
          <p className="text-sm font-semibold leading-tight text-txt">
            {t("signatureName")}
          </p>
          <p className="text-xs mt-0.5 text-muted">{t("signatureRole")}</p>
          <p className="text-[0.7rem] mt-1 font-mono text-muted-2">
            {t("signatureContact", { domain })}
          </p>
          <div className="mt-4">
            <a
              href={sealUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={darkPreviewSrc}
                alt={previewAlt}
                width={badgeW}
                height={badgeH}
                className="block max-w-full h-auto light:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightPreviewSrc}
                alt={previewAlt}
                width={badgeW}
                height={badgeH}
                className="hidden max-w-full h-auto light:block"
              />
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={`w-full h-11 rounded-lg text-sm font-semibold tracking-wide transition-opacity border ${
          status === "copied"
            ? "bg-verified/15 text-verified border-verified/30"
            : status === "error"
              ? "bg-red-500/15 text-red-400 border-red-500/30"
              : "bg-accent text-white border-accent hover:opacity-90"
        }`}
      >
        {status === "copied"
          ? t("copyDone")
          : status === "error"
            ? t("copyError")
            : t("copyBadge")}
      </button>

      <p className="text-[0.7rem] text-muted-2 leading-relaxed">
        {t("howTo")}
      </p>
    </div>
  );
}
