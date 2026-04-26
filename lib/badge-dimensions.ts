// Badge layout constants for the Split Pill (current ETag: v16).
//
//   ┌──────────────────┬──────────────────┐
//   │  ✓  Verified     │     acme.com     │
//   └──────────────────┴──────────────────┘
//      tinted (state)        neutral (theme-aware)
//
// Two structurally distinct halves communicate exactly what each
// fragment represents:
//
//   LEFT  — variable status. Background changes with the tier
//           (green for Verified, amber for Building) and carries
//           the state icon + state word. The reader's eye lands here
//           first because the color is the most distinctive element
//           on the canvas. Fixed width so a Verified badge and a
//           Building badge for the same domain share the exact same
//           canvas — no reflow on graduation.
//   RIGHT — the domain itself ("acme.com"). Theme-aware neutral
//           background (light or dark stone) + monospace domain text.
//           This half answers the standalone-context question: when
//           the badge is dropped on a Linktree, an invoice footer, or
//           any surface without surrounding email-signature context,
//           the reader knows immediately *which* domain is being
//           vouched for. Variable width — adapts to the domain length.
//
// Brand attribution lives in the *click target* (`witnessed.cc/b/<domain>`),
// not in the rendered pixels. Earlier iterations (v13–v15) hard-coded
// `witnessed.cc` as the right-half wordmark; that read as "witnessed.cc
// is verified" on every page and was the wrong call.
//
// Theme variance is reintroduced because the right half's background
// is the half most likely to clash with an email client's chrome. A
// dark stone right half on a white-bg Gmail composes heavy; a light
// stone right half on a dark-mode Apple Mail composes weak. Owners
// pick the variant that matches their email context (controlled by
// the site theme — what they see in the seal-page preview is what
// they paste).
//
// This module is pure JS — safe to import from server routes and
// client components alike, which keeps the rendered image and the
// `<img>` element's advertised dimensions in lockstep.

import type { BadgeState } from "@/lib/badge-state";

// ── Public dimensions ─────────────────────────────────────────
//
// Height stays at 32px so the badge remains signature-compatible
// (the standard email signature line height). Width is *domain-
// adaptive*: short domains produce compact pills; long domains grow
// up to a hard cap and then truncate with an ellipsis.
//
// Pre-v16 the canvas was a constant 212×32. That property was nice
// for signatures stacking multiple badges side by side, but in
// practice signatures carry one badge for one domain — the constant-
// width property never paid for the loss of the "what domain is
// this vouching for?" answer.
export const BADGE_HEIGHT = 32;

// ── Half widths ──────────────────────────────────────────────
//
// LEFT half is a constant 104px — wide enough for the longest state
// word ("Verified") + icon + pads, with ~10px of slack. Same value
// shipped in v15. Holds because the LEFT half does NOT depend on the
// domain; it's purely state-driven.
export const LEFT_W = 104;

// ── Inner layout ─────────────────────────────────────────────
//
// Pads + icon size, used by the SVG/PNG renderers. The state word
// is rendered with a fixed-width slot wide enough for any tier's
// label, so a "Verified" badge and a "Building" badge produce the
// exact same LEFT half — no reflow on graduation.
export const PAD_L = 10;     // outer left pad on LEFT half
export const PAD_R = 12;     // outer right pad on RIGHT half
export const ICON_D = 14;    // icon diameter (px)
export const GAP_ICON_TEXT = 8; // gap between icon and state word

// Typography (monospace metric estimate for SF Mono / Menlo / Consolas).
// Both halves use the same family + size for visual consistency.
const CHAR_W = 7.8;

// ── State words ──────────────────────────────────────────────
//
// English-only on purpose: badges live in email signatures that cross
// locale boundaries, and an `<img>` URL isn't a reliable place to derive
// a caller locale. Keys mirror the canonical TrustTier so the codebase
// and the UI never drift apart.
export const STATE_WORDS: Record<BadgeState, string> = {
  verified: "Verified",
  building: "Building",
};

// Longest state word dictates the reserved slot width on the LEFT half.
// "Verified" and "Building" are both 8 chars today — kept as a derivation
// so a future state word can't silently overflow the slot.
const STATE_WORD_MAX_CHARS = Math.max(
  ...Object.values(STATE_WORDS).map((w) => w.length),
);
export const STATE_W_RESERVED = STATE_WORD_MAX_CHARS * CHAR_W;

// ── Theme palette (RIGHT half) ───────────────────────────────
//
// LEFT half stays state-tinted regardless of theme — green/amber are
// saturated enough to read on either bg, and the state color IS the
// state's identity. Only the RIGHT half flips with theme.
//
//   dark  — warm-neutral charcoal (stone-900) + light text. Reads
//           cleanly on dark email clients (Apple Mail dark mode,
//           Outlook dark theme).
//   light — near-white (stone-50) + dark text + subtle border. Reads
//           cleanly on white email clients (Gmail web, Apple Mail
//           default).
//
// Owners pick the variant that matches their email context via the
// site theme toggle (preview + copied HTML stay in lockstep).
export type BadgeTheme = "light" | "dark";

export const DEFAULT_BADGE_THEME: BadgeTheme = "dark";

export interface BadgeThemePalette {
  rightBg: string;
  rightFg: string;
  border: string;
}

export const BADGE_THEMES: Record<BadgeTheme, BadgeThemePalette> = {
  dark: {
    rightBg: "#1c1917", // stone-900
    rightFg: "#f5f5f4", // stone-100
    border: "#0c0a09",  // stone-950
  },
  light: {
    rightBg: "#fafaf9", // stone-50
    rightFg: "#1c1917", // stone-900
    border: "#d6d3d1",  // stone-300 — visible separation from white email bg
  },
};

export function isBadgeTheme(value: string | null | undefined): value is BadgeTheme {
  return value === "light" || value === "dark";
}

// ── Right-half width (adaptive) ──────────────────────────────
//
// The right half hosts the domain text. Width = horizontal pads +
// rendered char count × monospace metric, with a floor (so a 4-char
// domain doesn't produce a comically narrow half) and an implicit
// ceiling enforced by `truncateDomain`.
const MIN_RIGHT_W = 88; // floor — keeps the pill from looking lopsided
export const MAX_DOMAIN_CHARS = 26; // longer domains get an ellipsis

// Truncates a domain to the rendered char budget. Middle-ellipsis
// would be more "honest" but also more ambiguous (which TLD?), and
// in practice the pathological case is a long subdomain on a short
// root, so a tail-ellipsis preserves the suffix identity.
export function truncateDomain(domain: string): string {
  if (domain.length <= MAX_DOMAIN_CHARS) return domain;
  return domain.slice(0, MAX_DOMAIN_CHARS - 1) + "…";
}

export function rightWidthFor(domain: string): number {
  const text = truncateDomain(domain);
  const w = Math.ceil(text.length * CHAR_W) + PAD_R * 2;
  return Math.max(w, MIN_RIGHT_W);
}

// ── sizeBadge: total canvas for a domain ─────────────────────
//
// Total width = fixed LEFT_W + adaptive right half. Callers
// (BadgeEmbed, landing-page demo, badge route) use the result to
// keep the rendered image and the `<img>` tag's advertised
// dimensions in lockstep — pasted signatures never reflow because
// the `<img width=…>` matches the PNG's intrinsic width.
export function sizeBadge(domain: string): {
  width: number;
  height: number;
} {
  return {
    width: LEFT_W + rightWidthFor(domain),
    height: BADGE_HEIGHT,
  };
}
