import { sizeBadge } from "@/lib/badge-dimensions";

// Marketing-only badge image used on the landing page demo.
//
// Renders BOTH theme variants stacked, then lets CSS pick the active
// one via the `light:` Tailwind variant (which selects on `html.light`,
// the same class the navbar's no-flash script flips before first
// paint). Both `<img>` tags are in the DOM at all times, but only one
// is `display: inline-block` at any given moment — toggling the site
// theme flips a CSS class and swaps which variant is laid out.
//
// The reason it's two images instead of one with a JS-driven src is
// hydration timing: on page reload, the SSR'd HTML doesn't know the
// user's stored theme (it's in localStorage), so a single-image
// approach ships a `?theme=dark` URL, the browser starts loading the
// dark variant, and only after hydration does an effect swap the src
// to light. The CSS approach sidesteps that entirely — both images
// load in parallel; the right one is visible from frame zero.
//
// Rendered as a server component (no `"use client"`) because it has
// no client state, no event handlers, and no observers — the heavy
// lifting is pure CSS.
export default function DemoBadge({
  domain,
  state,
}: {
  domain: string;
  state: "verified" | "building";
}) {
  const { width, height } = sizeBadge(domain);
  const darkSrc = `/badge/${domain}.svg?preview=${state}&theme=dark`;
  const lightSrc = `/badge/${domain}.svg?preview=${state}&theme=light`;
  const alt = `Witnessed · ${domain}`;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={darkSrc}
        alt={alt}
        width={width}
        height={height}
        className="inline-block light:hidden border-0 align-middle select-none"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        className="hidden light:inline-block border-0 align-middle select-none"
        draggable={false}
      />
    </>
  );
}
