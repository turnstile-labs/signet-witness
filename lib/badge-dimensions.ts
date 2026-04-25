// Badge layout constants + dimension helpers.
//
// The badge renders as a state-colored pill:
//
//   [ icon ]  [ STATE WORD ]  ·  [ domain ]
//
// Verified = solid green, bold "Verified", white domain, inline check.
// Building = solid amber, bold "Building", white domain, inline filled dot.
// Pending  = transparent pill, gray border, gray "Pending" + domain, hollow ring.
//
// The state word was added in v11 because color + icon alone didn't
// tell strangers apart from "Verified" at a glance — an amber pill
// with a dot can read as "also approved" to a recipient who has no
// Witnessed mental model. The literal word removes that ambiguity:
// Verified says "Verified", Building says "Building", Pending says
// "Pending". No score readout, no progress ring — the precise 0–100
// trust index lives on the seal page. Badges are identity; seal
// pages are data.
//
// Width adapts to the domain length so the canvas feels tailored
// instead of a stretched template. Height stays fixed so the badge
// remains compatible with every email signature layout we've tested.
// The state-word slot is reserved at a fixed width (max-of-all-state-
// words) so the overall badge width is stable across a domain's
// Pending → Building → Verified transitions — a pasted <img> tag
// keeps reading sanely even after the state moves.
//
// This module is pure JS — safe to import from server routes
// (app/badge/[slug]/route.tsx) and client components (BadgeEmbed.tsx)
// alike, which keeps the rendered image and the <img> element's
// advertised dimensions in lockstep.

import type { BadgeState } from "@/lib/badge-state";

export const BADGE_HEIGHT = 32;
export const BADGE_MIN_WIDTH = 140;
export const BADGE_MAX_WIDTH = 320;

// Layout (logical px, matches the SVG viewBox).
export const PAD_L = 12;
export const PAD_R = 14;
export const ICON_D = 14;
export const GAP_ICON_DOMAIN = 10;

// Typography — metric estimate for SF Mono / Menlo / Consolas. Domain
// and state word both sit at 13px. The state word is weight 700, the
// domain is weight 600 — same glyph width budget either way.
const DOMAIN_CHAR_W = 7.8;

// Public-facing state words. Short, capitalised, one per tier. Mirror
// what the seal page + extension popup show, so a user who sees a
// "Building" badge in a signature and then visits the seal page lands
// on the same label. English-only on purpose: badges live on email
// signatures that cross locale boundaries, and an <img> URL isn't a
// reliable place to derive a caller locale.
export const STATE_WORDS: Record<BadgeState, string> = {
  verified: "Verified",
  onRecord: "Building",
  pending: "Pending",
};

// Longest state word dictates the reserved slot width. Fixed reservation
// means badge width stays stable across state transitions, so an <img>
// embedded in a signature never reflows when the domain graduates.
const STATE_WORD_MAX_CHARS = Math.max(
  ...Object.values(STATE_WORDS).map((w) => w.length),
);
export const STATE_W_RESERVED = STATE_WORD_MAX_CHARS * DOMAIN_CHAR_W;

// Separator between state word and domain: " · " — space, middle-dot,
// space. Three glyph cells.
export const SEP_W = 3 * DOMAIN_CHAR_W;

// Hard cap on domain chars — keeps the canvas under BADGE_MAX_WIDTH
// with room for the icon, the reserved state-word slot, the separator
// and padding. Anything longer is ellipsised.
export const DOMAIN_MAX_CHARS = Math.floor(
  (BADGE_MAX_WIDTH -
    PAD_L -
    ICON_D -
    GAP_ICON_DOMAIN -
    STATE_W_RESERVED -
    SEP_W -
    PAD_R) /
    DOMAIN_CHAR_W,
);

export function truncateDomainForBadge(domain: string): string {
  if (domain.length <= DOMAIN_MAX_CHARS) return domain;
  return domain.slice(0, Math.max(1, DOMAIN_MAX_CHARS - 1)) + "…";
}

// Width of the badge canvas for a given (already-truncated) domain.
// Callers typically do: computeBadgeWidth(truncateDomainForBadge(d)).
//
// State-agnostic on purpose: we reserve room for the widest state word
// regardless of which one will actually render. That keeps the PNG
// pixel dimensions and the <img width=…> attribute aligned across a
// domain's lifetime, so Gmail/Apple Mail/Outlook never have to reflow
// a signature when the tier moves from Pending to Building to Verified.
export function computeBadgeWidth(displayDomain: string): number {
  const domainW = displayDomain.length * DOMAIN_CHAR_W;
  const raw =
    PAD_L +
    ICON_D +
    GAP_ICON_DOMAIN +
    STATE_W_RESERVED +
    SEP_W +
    domainW +
    PAD_R;
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
