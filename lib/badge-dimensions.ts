// Badge layout constants + dimension helpers.
//
// The badge renders as: [ domain ]   [ witnessed.cc ]   [ ✓ ]
// Width adapts to the domain length so the canvas feels tailored
// instead of a stretched template. Height stays fixed so the badge
// remains compatible with every email signature layout we've tested.
//
// This module is pure JS — safe to import from server routes
// (app/badge/[slug]/route.tsx) and client components (BadgeEmbed.tsx)
// alike, which keeps the rendered image and the <img> element's
// advertised dimensions in lockstep.

export const BADGE_HEIGHT = 32;
export const BADGE_MIN_WIDTH = 180;
export const BADGE_MAX_WIDTH = 360;

// Layout (logical px, matches the SVG viewBox).
export const PAD_L = 12;
export const PAD_R = 12;
export const MARK_D = 16;
export const GAP_DOMAIN_BRAND = 12;
export const GAP_BRAND_MARK = 12;

// Typography — metric estimates for SF Mono / Menlo / Consolas. These
// don't have to be exact; we clamp against min/max and truncate the
// domain before we'd ever run past the canvas.
const DOMAIN_CHAR_W = 7.2; // 12px @ weight 600
const BRAND_CHAR_W = 5.4; // 9px @ weight 400

export const BRAND_TEXT = "witnessed.cc";
export const BRAND_WIDTH = Math.ceil(BRAND_TEXT.length * BRAND_CHAR_W);

// Hard cap on domain chars — keeps the canvas under BADGE_MAX_WIDTH
// with room for the brand and mark. Anything longer is ellipsised.
export const DOMAIN_MAX_CHARS = Math.floor(
  (BADGE_MAX_WIDTH -
    PAD_L -
    PAD_R -
    GAP_DOMAIN_BRAND -
    BRAND_WIDTH -
    GAP_BRAND_MARK -
    MARK_D) /
    DOMAIN_CHAR_W,
);

export function truncateDomainForBadge(domain: string): string {
  if (domain.length <= DOMAIN_MAX_CHARS) return domain;
  return domain.slice(0, Math.max(1, DOMAIN_MAX_CHARS - 1)) + "…";
}

// Width of the badge canvas for a given (already-truncated) domain.
// Callers typically do: computeBadgeWidth(truncateDomainForBadge(d)).
export function computeBadgeWidth(displayDomain: string): number {
  const domainW = displayDomain.length * DOMAIN_CHAR_W;
  const raw =
    PAD_L +
    domainW +
    GAP_DOMAIN_BRAND +
    BRAND_WIDTH +
    GAP_BRAND_MARK +
    MARK_D +
    PAD_R;
  const clamped = Math.max(
    BADGE_MIN_WIDTH,
    Math.min(BADGE_MAX_WIDTH, Math.ceil(raw)),
  );
  return clamped;
}

// Convenience: full path — domain in, (display text, width) out.
export function sizeBadge(domain: string): {
  display: string;
  width: number;
  height: number;
} {
  const display = truncateDomainForBadge(domain);
  return { display, width: computeBadgeWidth(display), height: BADGE_HEIGHT };
}
