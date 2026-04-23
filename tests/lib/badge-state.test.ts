import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ringFraction,
  ringArcPath,
  trustBucket,
  resolveSnapshot,
} from "@/lib/badge-state";
import type { DomainScore } from "@/lib/scores";

vi.mock("@/lib/db", () => ({
  getDomain: vi.fn(),
}));
vi.mock("@/lib/scores", () => ({
  getDomainScore: vi.fn(),
  computeVerified: vi.fn(),
  trustTierFromScore: vi.fn(),
}));

import { getDomain } from "@/lib/db";
import {
  getDomainScore,
  computeVerified,
  trustTierFromScore,
} from "@/lib/scores";

const getDomainMock = vi.mocked(getDomain);
const getDomainScoreMock = vi.mocked(getDomainScore);
const computeVerifiedMock = vi.mocked(computeVerified);
const trustTierFromScoreMock = vi.mocked(trustTierFromScore);

const baseScore: DomainScore = {
  verified_event_count: 10,
  counterparty_count: 4,
  mutual_counterparties: 3,
  diversity: 0.6,
  tenure_days: 90,
  trust_index: 72,
  computed_at: new Date().toISOString(),
};

describe("badge-state / ring math", () => {
  describe("ringFraction", () => {
    it("clamps 0 at the floor", () => {
      expect(ringFraction(0)).toBe(0);
      expect(ringFraction(-10)).toBe(0);
    });

    it("clamps 100 at the ceiling", () => {
      expect(ringFraction(100)).toBe(1);
      expect(ringFraction(250)).toBe(1);
    });

    it("produces a proportional mid value", () => {
      expect(ringFraction(50)).toBe(0.5);
      expect(ringFraction(65)).toBeCloseTo(0.65, 5);
    });

    it("treats non-finite inputs as 0", () => {
      expect(ringFraction(NaN)).toBe(0);
      expect(ringFraction(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe("ringArcPath", () => {
    it("returns empty string below the draw threshold", () => {
      expect(ringArcPath(10, 10, 5, 0)).toBe("");
      expect(ringArcPath(10, 10, 5, 0.003)).toBe("");
    });

    it("returns a closed path at full fraction", () => {
      const p = ringArcPath(10, 10, 5, 1);
      expect(p).toMatch(/Z$/);
      expect(p).toContain("A 5 5");
    });

    it("emits a normal arc with largeArc=0 below 50%", () => {
      const p = ringArcPath(10, 10, 5, 0.25);
      expect(p).toMatch(/A 5 5 0 0 1/);
    });

    it("emits a normal arc with largeArc=1 above 50%", () => {
      const p = ringArcPath(10, 10, 5, 0.75);
      expect(p).toMatch(/A 5 5 0 1 1/);
    });
  });

  describe("trustBucket", () => {
    it("buckets 0 to bin 0", () => {
      expect(trustBucket(0)).toBe(0);
    });

    it("buckets 100 to bin 20", () => {
      expect(trustBucket(100)).toBe(20);
    });

    it("groups scores within a 5-point bin together", () => {
      // Bin width is 5, aligned to multiples of 5. 66-69 share bin 13.
      expect(trustBucket(66)).toBe(trustBucket(69));
    });

    it("advances to a new bin at the 5-point boundary", () => {
      expect(trustBucket(64)).toBeLessThan(trustBucket(65));
    });
  });
});

describe("badge-state / resolveSnapshot", () => {
  beforeEach(() => {
    getDomainMock.mockReset();
    getDomainScoreMock.mockReset();
    computeVerifiedMock.mockReset();
    trustTierFromScoreMock.mockReset();
  });

  it("returns pending when the domain is not registered", async () => {
    getDomainMock.mockResolvedValue(null);
    const snap = await resolveSnapshot("ghost.example");
    expect(snap).toEqual({ state: "pending", count: 0, trustIndex: 0 });
  });

  const fakeDomain = (over: Partial<Awaited<ReturnType<typeof getDomain>>>) => ({
    id: 1,
    domain: "acme.com",
    event_count: 0,
    first_seen: new Date().toISOString(),
    tier: "free",
    grandfathered_verified: false,
    updated_at: new Date().toISOString(),
    ...over,
  });

  it("bubbles the score's trust index on a normal onRecord domain", async () => {
    getDomainMock.mockResolvedValue(fakeDomain({ event_count: 7 }));
    getDomainScoreMock.mockResolvedValue({ ...baseScore, trust_index: 42 });
    computeVerifiedMock.mockReturnValue({ isVerified: false, reason: null });
    trustTierFromScoreMock.mockReturnValue("onRecord");

    const snap = await resolveSnapshot("acme.com");
    expect(snap).toEqual({ state: "onRecord", count: 7, trustIndex: 42 });
  });

  it("floors a grandfathered domain's ring at 100 even if its computed score lags", async () => {
    getDomainMock.mockResolvedValue(
      fakeDomain({
        id: 2,
        domain: "legacy.co",
        event_count: 11,
        grandfathered_verified: true,
      }),
    );
    getDomainScoreMock.mockResolvedValue({ ...baseScore, trust_index: 40 });
    computeVerifiedMock.mockReturnValue({
      isVerified: true,
      reason: "grandfathered",
    });
    trustTierFromScoreMock.mockReturnValue("verified");

    const snap = await resolveSnapshot("legacy.co");
    expect(snap.state).toBe("verified");
    expect(snap.trustIndex).toBe(100);
  });

  it("falls through to pending when the score lookup returns null", async () => {
    getDomainMock.mockResolvedValue(
      fakeDomain({ id: 3, domain: "new.dev" }),
    );
    getDomainScoreMock.mockResolvedValue(null);
    computeVerifiedMock.mockReturnValue({ isVerified: false, reason: null });
    trustTierFromScoreMock.mockReturnValue("pending");

    const snap = await resolveSnapshot("new.dev");
    expect(snap).toEqual({ state: "pending", count: 0, trustIndex: 0 });
  });

  it("fails closed (pending) when getDomain throws", async () => {
    getDomainMock.mockRejectedValue(new Error("db down"));
    const snap = await resolveSnapshot("boom.com");
    expect(snap).toEqual({ state: "pending", count: 0, trustIndex: 0 });
  });
});
