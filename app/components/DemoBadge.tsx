"use client";

import { useEffect } from "react";
import { sizeBadge } from "@/lib/badge-dimensions";
import { useSiteTheme } from "@/app/components/useSiteTheme";

// Marketing-only badge image used on the landing page demo. Wraps a
// single `<img>` tag with two behaviours the rest of the page (a
// server component) can't supply on its own:
//
//   1. Theme awareness — the demo follows the navbar light/dark
//      toggle the same way the seal page's BadgeEmbed does, so the
//      "what you'll paste" promise holds on the marketing surface
//      too.
//   2. Variant preload — both `?theme=light` and `?theme=dark` are
//      requested on mount so the toggle swap is a cache hit, never
//      a "dark flash before the light variant arrives".
//
// `?preview=<state>` short-circuits the DB lookup at the route level,
// so this component never produces a real domain lookup — it's a
// pure presentation surface for a fake demo domain (`acme.studio`).
export default function DemoBadge({
  domain,
  state,
}: {
  domain: string;
  state: "verified" | "building";
}) {
  const theme = useSiteTheme();
  const { width, height } = sizeBadge(domain);
  const src = `/badge/${domain}.svg?preview=${state}&theme=${theme}`;

  useEffect(() => {
    for (const t of ["light", "dark"] as const) {
      const preload = new Image();
      preload.src = `/badge/${domain}.svg?preview=${state}&theme=${t}`;
    }
  }, [domain, state]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={`Witnessed · ${domain}`}
      width={width}
      height={height}
      className="border-0 inline-block align-middle select-none"
      draggable={false}
    />
  );
}
