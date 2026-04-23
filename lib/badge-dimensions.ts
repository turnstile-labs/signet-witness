// Badge layout constants + dimension helpers.
//
// The badge renders as a state-colored pill:
//
//   [ icon ]  [ domain ]
//
// Verified/onRecord = filled pill (green/amber), white text, inline icon.
// Pending           = outline pill, muted text, outlined icon.
//
// No score readout, no progress ring — the badge answers "does this
// domain have a sealed history?" categorically, via its background
// color and icon. The full 0–100 trust index lives on the seal page.
// Badges are identity; seal pages are data.
//
// Width adapts to the domain length so the canvas feels tailored
// instead of a stretched template. Height stays fixed so the badge
// remains compatible with every email signature layout we've tested.
//
// This module is pure JS — safe to import from server routes
// (app/badge/[slug]/route.tsx) and client components (BadgeEmbed.tsx)
// alike, which keeps the rendered image and the <img> element's
// advertised dimensions in lockstep.

export const BADGE_HEIGHT = 32;
export const BADGE_MIN_WIDTH = 140;
export const BADGE_MAX_WIDTH = 320;

// Layout (logical px, matches the SVG viewBox).
export const PAD_L = 12;
export const PAD_R = 14;
export const ICON_D = 14;
export const GAP_ICON_DOMAIN = 10;

// Typography — metric estimate for SF Mono / Menlo / Consolas. Domain
// sits at 13px, weight 600. We clamp against min/max and truncate the
// domain before we'd ever run past the canvas.
const DOMAIN_CHAR_W = 7.8;

// Hard cap on domain chars — keeps the canvas under BADGE_MAX_WIDTH
// with room for the icon and padding. Anything longer is ellipsised.
export const DOMAIN_MAX_CHARS = Math.floor(
  (BADGE_MAX_WIDTH - PAD_L - ICON_D - GAP_ICON_DOMAIN - PAD_R) / DOMAIN_CHAR_W,
);

export function truncateDomainForBadge(domain: string): string {
  if (domain.length <= DOMAIN_MAX_CHARS) return domain;
  return domain.slice(0, Math.max(1, DOMAIN_MAX_CHARS - 1)) + "…";
}

// Width of the badge canvas for a given (already-truncated) domain.
// Callers typically do: computeBadgeWidth(truncateDomainForBadge(d)).
export function computeBadgeWidth(displayDomain: string): number {
  const domainW = displayDomain.length * DOMAIN_CHAR_W;
  const raw = PAD_L + ICON_D + GAP_ICON_DOMAIN + domainW + PAD_R;
  const clamped = Math.max(
    BADGE_MIN_WIDTH,
    Math.min(BADGE_MAX_WIDTH, Math.ceil(raw)),
  );
  return clamped;
}

// Convenience: full path — domain in, (display text, width, height) out.
export function sizeBadge(domain: string): {
  display: string;
  width: number;
  height: number;
} {
  const display = truncateDomainForBadge(domain);
  return { display, width: computeBadgeWidth(display), height: BADGE_HEIGHT };
}
