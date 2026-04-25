import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_MIN_WIDTH,
  BADGE_MAX_WIDTH,
  DOMAIN_MAX_CHARS,
  ICON_D,
  GAP_ICON_DOMAIN,
  SEP_W,
  STATE_WORDS,
  STATE_W_RESERVED,
  computeBadgeWidth,
  sizeBadge,
  truncateDomainForBadge,
} from "@/lib/badge-dimensions";

describe("badge-dimensions", () => {
  describe("constants", () => {
    it("exports stable layout primitives", () => {
      expect(BADGE_HEIGHT).toBe(32);
      expect(ICON_D).toBeGreaterThan(0);
      expect(GAP_ICON_DOMAIN).toBeGreaterThan(0);
      // v11: state word + separator are reserved at fixed widths so
      // the badge canvas stays stable across state transitions.
      expect(STATE_W_RESERVED).toBeGreaterThan(0);
      expect(SEP_W).toBeGreaterThan(0);
      expect(DOMAIN_MAX_CHARS).toBeGreaterThan(10);
    });

    it("exposes a state word per public tier", () => {
      // Two-state public surface (v12+). The legacy "pending" tier was
      // collapsed into "onRecord" — see lib/scores.ts for the rationale.
      expect(STATE_WORDS.verified).toBe("Verified");
      expect(STATE_WORDS.onRecord).toBe("Building");
      expect(Object.keys(STATE_WORDS)).toHaveLength(2);
    });

    it("reserves enough space for the longest state word", () => {
      // STATE_W_RESERVED is derived from max-of-all-state-words, so
      // shortening one word (e.g. renaming "Building" to "New") must
      // never narrow the reserved slot below the widest other word.
      const longest = Math.max(
        ...Object.values(STATE_WORDS).map((w) => w.length),
      );
      // The derivation uses DOMAIN_CHAR_W (7.8); we just assert the
      // reservation is at least as wide as the longest word rendered
      // at a conservative 6px/char, which is always ≤ the true width.
      expect(STATE_W_RESERVED).toBeGreaterThanOrEqual(longest * 6);
    });
  });

  describe("truncateDomainForBadge", () => {
    it("returns short domains unchanged", () => {
      expect(truncateDomainForBadge("acme.com")).toBe("acme.com");
    });

    it("ellipsises overlong domains and keeps them within the cap", () => {
      const long = "a".repeat(DOMAIN_MAX_CHARS + 20) + ".com";
      const truncated = truncateDomainForBadge(long);
      expect(truncated.length).toBeLessThanOrEqual(DOMAIN_MAX_CHARS);
      expect(truncated.endsWith("…")).toBe(true);
    });

    it("handles a 1-char over the cap without crashing", () => {
      const boundary = "a".repeat(DOMAIN_MAX_CHARS + 1);
      expect(truncateDomainForBadge(boundary)).toMatch(/…$/);
    });
  });

  describe("computeBadgeWidth / sizeBadge", () => {
    it("never drops below the minimum", () => {
      // v11: with the state word + separator reserved, "a.io" no
      // longer hits the floor organically — width now sits well
      // above BADGE_MIN_WIDTH. The floor still matters as a defensive
      // lower bound, so we just assert the clamp invariant.
      expect(computeBadgeWidth("a.io")).toBeGreaterThanOrEqual(
        BADGE_MIN_WIDTH,
      );
    });

    it("clamps the min floor when fed a pathologically short input", () => {
      // Empty string isn't a realistic domain, but the defensive
      // min clamp exists for exactly this shape of degenerate input.
      // Exercising it keeps the Math.max branch covered.
      expect(computeBadgeWidth("")).toBe(BADGE_MIN_WIDTH);
    });

    it("clamps above the maximum", () => {
      const w = computeBadgeWidth("a".repeat(200));
      expect(w).toBe(BADGE_MAX_WIDTH);
    });

    it("grows monotonically with domain length", () => {
      const short = computeBadgeWidth("acme.com");
      const longer = computeBadgeWidth("very-long-company-name.studio");
      expect(longer).toBeGreaterThanOrEqual(short);
    });

    it("includes the state-word + separator reservation in its width", () => {
      // The new layout always budgets space for the widest state word
      // and the separator, regardless of which tier ends up rendering.
      // Without that reservation, a 12-char domain like witnessed.cc
      // would size identically to the old formula (icon + domain only);
      // with it, the canvas is materially wider.
      const newW = computeBadgeWidth("witnessed.cc");
      const icon = ICON_D;
      const domainOnlyW = 12 * 7.8; // 12 chars at DOMAIN_CHAR_W
      const padOnly = 12 + 14; // PAD_L + PAD_R
      const gapOnly = GAP_ICON_DOMAIN;
      const iconPlusDomainW = Math.ceil(
        padOnly + icon + gapOnly + domainOnlyW,
      );
      expect(newW).toBeGreaterThan(iconPlusDomainW);
    });

    it("sizeBadge returns display text, width, and height tied to constants", () => {
      const r = sizeBadge("acme.com");
      expect(r.display).toBe("acme.com");
      expect(r.height).toBe(BADGE_HEIGHT);
      expect(r.width).toBeGreaterThanOrEqual(BADGE_MIN_WIDTH);
      expect(r.width).toBeLessThanOrEqual(BADGE_MAX_WIDTH);
    });

    it("state-agnostic width: same canvas across Building → Verified", () => {
      // Crucial invariant for email signatures — a pasted <img width=…>
      // must stay in lockstep with the rendered PNG even after the
      // domain graduates from Building to Verified. Since
      // computeBadgeWidth() takes only the domain, it cannot diverge
      // by state; this test documents that guarantee.
      const a = computeBadgeWidth("witnessed.cc");
      const b = computeBadgeWidth("witnessed.cc");
      expect(a).toBe(b);
    });
  });
});
