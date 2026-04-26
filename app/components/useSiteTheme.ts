"use client";

import { useEffect, useState } from "react";
import type { BadgeTheme } from "@/lib/badge-dimensions";

// Subscribes to the navbar's light/dark toggle by observing the
// `html.light` class. Returns the current site theme as a BadgeTheme
// (the badge's two-variant palette tracks the site theme one-to-one).
//
// Hydration story: the SSR'd HTML doesn't know the user's stored theme
// preference (the no-flash inline script in `app/[locale]/layout.tsx`
// runs before render and adds `html.light` if the prefer was light),
// so we initialise to `"dark"` and the effect reconciles on mount.
// That means on first paint, a light-mode user briefly sees a badge
// URL keyed to `dark` — consumers preload both variants so the swap
// when the effect fires is invisible.
export function useSiteTheme(): BadgeTheme {
  const [theme, setTheme] = useState<BadgeTheme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const read = (): BadgeTheme =>
      root.classList.contains("light") ? "light" : "dark";
    setTheme(read());

    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
