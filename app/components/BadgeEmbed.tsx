"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";

// Owner-facing badge surface on the seal page. Visually mirrors the
// landing's badge section so what you preview is what gets pasted.
// One job: get a *clickable* badge onto the clipboard so the owner
// can paste it into their email signature (Gmail, Apple Mail, Outlook).
//
// The preview + copied HTML both follow site theme (toggled via the
// navbar by flipping `html.light`). Owners who want a light badge for
// Gmail flip the site to light mode, verify the mock, and copy.
// Rich-text copy via navigator.clipboard.write([ClipboardItem]) is
// what makes this work — Gmail's signature editor is WYSIWYG and
// only preserves formatting from the clipboard's text/html entry.

export default function BadgeEmbed({ domain }: { domain: string }) {
  const t = useTranslations("badge");
  const theme = useSiteTheme();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const origin = "https://witnessed.cc";
  const themeParam = theme === "light" ? "?theme=light" : "";
  const sealUrl = `${origin}/b/${domain}`;
  const imageUrl = `${origin}/badge/${domain}.png${themeParam}`;
  const previewSrc = `/badge/${domain}.png${themeParam}`;
  const html = `<a href="${sealUrl}"><img src="${imageUrl}" alt="Witnessed · ${domain}" width="260" height="26" style="border:0;display:inline-block;vertical-align:middle" /></a>`;

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

  const cardBg = theme === "dark" ? "bg-[#0c0c0f]" : "bg-white";
  const cardBorder = theme === "dark" ? "border-[#25252f]" : "border-[#e0e0ec]";
  const nameColor = theme === "dark" ? "text-white" : "text-[#0c0c0f]";
  const roleColor = theme === "dark" ? "text-[#a3a3b2]" : "text-[#4a4a57]";
  const contactColor = theme === "dark" ? "text-[#6a6a78]" : "text-[#6a6a78]";
  const labelColor = theme === "dark" ? "text-[#6a6a78]" : "text-[#8a8a99]";
  const dividerColor = theme === "dark" ? "border-[#25252f]" : "border-[#e0e0ec]";

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border overflow-hidden transition-colors ${cardBg} ${cardBorder}`}
      >
        <div
          className={`px-5 py-2.5 border-b text-[0.6rem] font-mono uppercase tracking-widest ${dividerColor} ${labelColor}`}
        >
          {t("mockLabel")}
        </div>
        <div className="px-5 py-5">
          <p className={`text-sm font-semibold leading-tight ${nameColor}`}>
            {t("signatureName")}
          </p>
          <p className={`text-xs mt-0.5 ${roleColor}`}>
            {t("signatureRole")}
          </p>
          <p className={`text-[0.7rem] mt-1 font-mono ${contactColor}`}>
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
                src={previewSrc}
                alt={t("alt", { domain })}
                width={260}
                height={26}
                className="max-w-full h-auto block"
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

// Subscribe to the site-wide `html.light` toggle. We observe the
// documentElement class list so the preview + copied HTML reflect the
// current theme reactively — no local state, no duplicate toggle UI.
function useSiteTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.classList.contains("light") ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
