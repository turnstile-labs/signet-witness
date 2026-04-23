import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_MIN_WIDTH,
  BADGE_MAX_WIDTH,
  BRAND_TEXT,
  BRAND_WIDTH,
  DOMAIN_MAX_CHARS,
  computeBadgeWidth,
  sizeBadge,
  truncateDomainForBadge,
} from "@/lib/badge-dimensions";

describe("badge-dimensions", () => {
  describe("constants", () => {
    it("exports stable layout primitives", () => {
      expect(BADGE_HEIGHT).toBe(32);
      expect(BRAND_TEXT).toBe("witnessed.cc");
      expect(BRAND_WIDTH).toBeGreaterThan(0);
      expect(DOMAIN_MAX_CHARS).toBeGreaterThan(10);
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
    it("clamps below the minimum", () => {
      expect(computeBadgeWidth("a.io")).toBe(BADGE_MIN_WIDTH);
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

    it("sizeBadge returns display text, width, and height tied to constants", () => {
      const r = sizeBadge("acme.com");
      expect(r.display).toBe("acme.com");
      expect(r.height).toBe(BADGE_HEIGHT);
      expect(r.width).toBeGreaterThanOrEqual(BADGE_MIN_WIDTH);
      expect(r.width).toBeLessThanOrEqual(BADGE_MAX_WIDTH);
    });
  });
});
