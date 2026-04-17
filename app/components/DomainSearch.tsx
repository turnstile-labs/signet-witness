"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DomainSearch() {
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="acme.com"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-txt placeholder:text-muted-2 focus:outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
        style={{ color: "#fff" }}
      >
        Look up
      </button>
    </form>
  );
}
