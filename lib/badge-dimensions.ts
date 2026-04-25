// Badge layout constants for the v13 Split Pill.
//
//   ┌──────────────────┬──────────────────┐
//   │  ✓  Verified     │   witnessed.cc   │
//   └──────────────────┴──────────────────┘
//      tinted (state)        neutral dark
//
// Two structurally distinct halves communicate exactly what each
// fragment represents:
//
//   LEFT  — variable status. Background changes with the tier
//           (green for Verified, amber for Building) and carries
//           the state icon + state word. The reader's eye lands here
//           first because the color is the most distinctive element
//           on the canvas.
//   RIGHT — immutable platform. Slate background, light text, the
//           wordmark "witnessed.cc". This half is identical for every
//           badge in the world; readers learn it as the brand mark
//           the same way they learn shields.io / GitHub badges.
//
// The embedded domain (e.g. "acme.com") was dropped from the rendered
// pixels in v13. Reasons:
//
//   1. Context already supplies it. A signature badge sits next to
//      `name@acme.com`; a website badge sits on `acme.com`. Showing
//      the domain inside the pill duplicated information the reader
//      already had.
//   2. Constant-width canvas. With domain text gone, every badge is
//      the same pixel size. Email signatures that mix multiple
//      witnessed.cc badges from different domains line up cleanly,
//      and the `<img>` in a copied signature can ship one fixed
//      `width`/`height` pair without parameter calculation.
//   3. Stronger brand identity. The Split Pill is the badge's
//      identity, not the embedded domain — same way `shields.io`
//      badges are identified by their split shape, not their text.
//
// The URL still encodes the domain (`/badge/acme.com.png`) because
// that's how we look up the rendered state — but it stops being
// surfaced as text.
//
// This module is pure JS — safe to import from server routes and
// client components alike, which keeps the rendered image and the
// `<img>` element's advertised dimensions in lockstep.

import type { BadgeState } from "@/lib/badge-state";

// ── Public dimensions ─────────────────────────────────────────
//
// Width is constant. Height stays at 32px so the badge remains
// signature-compatible (the standard email signature line height).
//
// v14 tightened the canvas from 224×32 (7:1) to 212×32 (~6.6:1).
// The 7:1 ratio rendered as a banner inside Gmail compose; 6.6:1
// reads as a stamp, which is what a signature mark should feel like.
// The savings come entirely from dead space on the LEFT half — the
// state word slot was over-provisioned. RIGHT half kept its breathing
// room around the wordmark.
//
// Note: an interim 204×32 (~6.4:1) was tried and shipped briefly. It
// was 8px too tight on the LEFT half: at the monospace metric Satori
// renders, "Verified" landed within ~2px of the divider, which read
// as overflow. 212×32 restores ~10px of slack between the longest
// state word and the divider while keeping the stamp feel.
export const BADGE_HEIGHT = 32;
export const BADGE_WIDTH = 212;

// ── Half widths ──────────────────────────────────────────────
//
// The pill is structurally split at LEFT_W. Both halves share the
// same height; LEFT carries icon + state word, RIGHT carries the
// wordmark "witnessed.cc". The split point is hard-coded — there
// is no responsive behaviour because nothing in the rendered output
// depends on per-domain text length anymore.
export const LEFT_W = 104;
export const RIGHT_W = BADGE_WIDTH - LEFT_W;

// ── Inner layout ─────────────────────────────────────────────
//
// Pads + icon size, used by the SVG/PNG renderers. The state word
// is rendered with a fixed-width slot wide enough for any tier's
// label, so a "Verified" badge and a "Building" badge produce the
// exact same canvas — no reflow on graduation.
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

// ── Platform wordmark ────────────────────────────────────────
//
// The right half always renders this. Constant. If the brand domain ever
// changes, update here and the renderer picks it up — no other surface
// hard-codes it.
export const PLATFORM_LABEL = "witnessed.cc";

// ── sizeBadge: legacy API surface ────────────────────────────
//
// Returns constants regardless of `domain` so callers (BadgeEmbed,
// landing-page demo, badge route) can keep their existing call shape
// while the rendered output is now domain-independent. Width/height
// are stable — this is the whole point of the v13 redesign.
export function sizeBadge(_domain: string): {
  width: number;
  height: number;
} {
  return { width: BADGE_WIDTH, height: BADGE_HEIGHT };
}
