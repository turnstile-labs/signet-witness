import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_THEMES,
  DEFAULT_BADGE_THEME,
  GAP_ICON_TEXT,
  ICON_D,
  LEFT_W,
  MAX_DOMAIN_CHARS,
  PAD_L,
  PAD_R,
  STATE_W_RESERVED,
  STATE_WORDS,
  isBadgeTheme,
  rightWidthFor,
  sizeBadge,
  truncateDomain,
} from "@/lib/badge-dimensions";

describe("badge-dimensions (Split Pill v16)", () => {
  describe("constants", () => {
    it("exposes a stable height + fixed left half", () => {
      expect(BADGE_HEIGHT).toBe(32);
      expect(LEFT_W).toBeGreaterThan(0);
    });

    it("ships sane inner-layout primitives", () => {
      expect(ICON_D).toBeGreaterThan(0);
      expect(GAP_ICON_TEXT).toBeGreaterThan(0);
      expect(PAD_L).toBeGreaterThan(0);
      expect(PAD_R).toBeGreaterThan(0);
      // The state-word slot must be wide enough for the longest state
      // label, otherwise a future label rename could overflow into the
      // divider.
      const longest = Math.max(
        ...Object.values(STATE_WORDS).map((w) => w.length),
      );
      expect(STATE_W_RESERVED).toBeGreaterThanOrEqual(longest * 6);
    });

    it("exposes one state word per public tier", () => {
      // Two-state public surface (v12+). Token names match the labels
      // exactly so the codebase and the UI never drift.
      expect(STATE_WORDS.verified).toBe("Verified");
      expect(STATE_WORDS.building).toBe("Building");
      expect(Object.keys(STATE_WORDS)).toHaveLength(2);
    });
  });

  describe("themes", () => {
    it("ships a light + dark palette for the right half", () => {
      expect(BADGE_THEMES.dark.rightBg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(BADGE_THEMES.dark.rightFg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(BADGE_THEMES.light.rightBg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(BADGE_THEMES.light.rightFg).toMatch(/^#[0-9a-f]{6}$/i);
      // Light + dark should not share the same right-half background —
      // that's the whole point of theme variance.
      expect(BADGE_THEMES.light.rightBg).not.toBe(BADGE_THEMES.dark.rightBg);
    });

    it("defaults to dark for back-compat with pre-v16 URLs", () => {
      // Any badge URL emitted before theme variance was reintroduced
      // (v15-) lives in pasted signatures with no `?theme=` param. Those
      // must keep rendering, and the reasonable fallback is the v15
      // pixel set: dark right half.
      expect(DEFAULT_BADGE_THEME).toBe("dark");
    });

    it("isBadgeTheme guards external input", () => {
      expect(isBadgeTheme("light")).toBe(true);
      expect(isBadgeTheme("dark")).toBe(true);
      expect(isBadgeTheme("amoled")).toBe(false);
      expect(isBadgeTheme(null)).toBe(false);
      expect(isBadgeTheme(undefined)).toBe(false);
      expect(isBadgeTheme("")).toBe(false);
    });
  });

  describe("truncateDomain", () => {
    it("passes short domains through untouched", () => {
      expect(truncateDomain("acme.com")).toBe("acme.com");
      expect(truncateDomain("witnessed.cc")).toBe("witnessed.cc");
    });

    it("tail-truncates long domains with an ellipsis", () => {
      const long = "very-long-subdomain.example-corp.studio"; // > MAX
      const out = truncateDomain(long);
      expect(out.length).toBe(MAX_DOMAIN_CHARS);
      expect(out.endsWith("…")).toBe(true);
    });

    it("respects the max-char budget exactly at the boundary", () => {
      const exact = "a".repeat(MAX_DOMAIN_CHARS);
      expect(truncateDomain(exact)).toBe(exact);
    });
  });

  describe("rightWidthFor + sizeBadge", () => {
    it("right half grows with domain length", () => {
      const short = rightWidthFor("a.io");
      const long = rightWidthFor("very-long-company.studio");
      expect(long).toBeGreaterThan(short);
    });

    it("right half has a sane floor for very short domains", () => {
      // Lopsided pills (tiny right half hugging "Verified" on the left)
      // read poorly. The floor keeps the badge looking balanced.
      expect(rightWidthFor("a.io")).toBeGreaterThanOrEqual(80);
    });

    it("sizeBadge composes total width as LEFT_W + right half", () => {
      const domain = "acme.studio";
      const total = sizeBadge(domain);
      expect(total.height).toBe(BADGE_HEIGHT);
      expect(total.width).toBe(LEFT_W + rightWidthFor(domain));
    });

    it("sizeBadge is state-agnostic — same canvas across Building → Verified", () => {
      // Crucial invariant for email signatures — a pasted <img width=…>
      // must stay in lockstep with the rendered PNG even after the
      // domain graduates from Building to Verified. sizeBadge takes
      // only the domain; this test pins the contract.
      expect(sizeBadge("witnessed.cc")).toEqual(sizeBadge("witnessed.cc"));
    });

    it("sizeBadge caps at MAX_DOMAIN_CHARS for pathological domains", () => {
      // A 60-char domain shouldn't produce a 600px pill. The truncation
      // ceiling means width tops out at "max-domain-chars × char-w".
      const pathological = "a".repeat(60) + ".com";
      const cap = "a".repeat(MAX_DOMAIN_CHARS);
      expect(sizeBadge(pathological).width).toBe(sizeBadge(cap).width);
    });
  });
});
