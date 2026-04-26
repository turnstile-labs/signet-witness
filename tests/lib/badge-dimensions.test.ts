import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  GAP_ICON_TEXT,
  ICON_D,
  LEFT_W,
  PAD_L,
  PAD_R,
  PLATFORM_LABEL,
  RIGHT_W,
  STATE_W_RESERVED,
  STATE_WORDS,
  sizeBadge,
} from "@/lib/badge-dimensions";

describe("badge-dimensions (Split Pill)", () => {
  describe("constants", () => {
    it("exposes a stable, constant canvas", () => {
      expect(BADGE_HEIGHT).toBe(32);
      expect(BADGE_WIDTH).toBeGreaterThan(0);
      // The two halves account for the entire canvas — no slack space.
      expect(LEFT_W + RIGHT_W).toBe(BADGE_WIDTH);
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

    it("uses witnessed.cc as the immutable platform wordmark", () => {
      // The right half is the brand mark; renaming this token here is
      // the single source of truth for every badge in the wild.
      expect(PLATFORM_LABEL).toBe("witnessed.cc");
    });

    it("reserves room for the wordmark on the right half", () => {
      // The right half must fit "witnessed.cc" + outer pads at the
      // monospace metric used by the renderer (≤ 7.8 px/char).
      const wordmarkW = PLATFORM_LABEL.length * 7.8;
      expect(RIGHT_W).toBeGreaterThanOrEqual(wordmarkW + PAD_R);
    });
  });

  describe("sizeBadge", () => {
    it("returns the constant canvas regardless of domain length", () => {
      // The whole point of the Split Pill: the rendered output no longer depends
      // on the embedded domain, so width/height are stable. Pasted
      // <img width=…> tags stay accurate forever.
      const a = sizeBadge("acme.com");
      const b = sizeBadge("very-long-company-name.studio");
      const c = sizeBadge("");
      expect(a).toEqual({ width: BADGE_WIDTH, height: BADGE_HEIGHT });
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    });

    it("state-agnostic: same canvas across Building → Verified", () => {
      // Crucial invariant for email signatures — a pasted <img width=…>
      // must stay in lockstep with the rendered PNG even after the
      // domain graduates from Building to Verified. sizeBadge takes
      // only the domain; this test pins the contract.
      expect(sizeBadge("witnessed.cc")).toEqual(sizeBadge("witnessed.cc"));
    });
  });
});
