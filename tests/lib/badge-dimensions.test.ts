import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_MIN_WIDTH,
  BADGE_MAX_WIDTH,
  DOMAIN_MAX_CHARS,
  ICON_D,
  GAP_ICON_DOMAIN,
  computeBadgeWidth,
  sizeBadge,
  truncateDomainForBadge,
} from "@/lib/badge-dimensions";

describe("badge-dimensions", () => {
  describe("constants", () => {
    it("exports stable layout primitives", () => {
      expect(BADGE_HEIGHT).toBe(32);
      // Score slot and ring removed in v9 — the badge is now
      // [ icon ] [ domain ] only, so the layout primitives are
      // just the icon diameter and the icon↔domain gap.
      expect(ICON_D).toBeGreaterThan(0);
      expect(GAP_ICON_DOMAIN).toBeGreaterThan(0);
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
