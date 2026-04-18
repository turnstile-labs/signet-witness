"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface Props {
  placeholder: string;
  ariaLabel?: string;
}

export default function DomainSearch({ placeholder, ariaLabel }: Props) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const domain = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "");
    if (!domain) return;
    router.push(`/b/${encodeURIComponent(domain)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-3 h-10 focus-within:border-border-h transition-colors w-full max-w-xs"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label={ariaLabel ?? placeholder}
        className="bg-transparent outline-none text-sm font-mono text-txt placeholder:text-muted-2 flex-1 min-w-0"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Look up"
        className="shrink-0 text-accent disabled:text-muted-2 disabled:cursor-not-allowed enabled:hover:text-txt transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M1 6h9M6.5 2.5l3.5 3.5-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
