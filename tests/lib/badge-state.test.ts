import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveSnapshot } from "@/lib/badge-state";
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

describe("badge-state / resolveSnapshot", () => {
  beforeEach(() => {
    getDomainMock.mockReset();
    getDomainScoreMock.mockReset();
    computeVerifiedMock.mockReset();
    trustTierFromScoreMock.mockReset();
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

  it("returns pending when the domain is not registered", async () => {
    getDomainMock.mockResolvedValue(null);
    const snap = await resolveSnapshot("ghost.example");
    expect(snap).toEqual({ state: "pending", count: 0 });
  });

  it("returns the tier resolver's verdict on a claimed domain", async () => {
    getDomainMock.mockResolvedValue(fakeDomain({ event_count: 7 }));
    getDomainScoreMock.mockResolvedValue({ ...baseScore, trust_index: 42 });
    computeVerifiedMock.mockReturnValue({ isVerified: false, reason: null });
    trustTierFromScoreMock.mockReturnValue("onRecord");

    const snap = await resolveSnapshot("acme.com");
    expect(snap).toEqual({ state: "onRecord", count: 7 });
  });

  it("honours a grandfathered verified flag from computeVerified", async () => {
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
    expect(snap.count).toBe(11);
  });

  it("falls through to pending when the score lookup returns null", async () => {
    getDomainMock.mockResolvedValue(fakeDomain({ id: 3, domain: "new.dev" }));
    getDomainScoreMock.mockResolvedValue(null);
    computeVerifiedMock.mockReturnValue({ isVerified: false, reason: null });
    trustTierFromScoreMock.mockReturnValue("pending");

    const snap = await resolveSnapshot("new.dev");
    expect(snap).toEqual({ state: "pending", count: 0 });
  });

  it("fails closed (pending) when getDomain throws", async () => {
    getDomainMock.mockRejectedValue(new Error("db down"));
    const snap = await resolveSnapshot("boom.com");
    expect(snap).toEqual({ state: "pending", count: 0 });
  });
});
