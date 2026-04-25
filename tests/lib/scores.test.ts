import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FREE_MAIL_DOMAINS,
  VERIFIED_INDEX,
  MIN_MUTUALS,
  computeTrustIndex,
  computeVerified,
  trustTierFromScore,
  markDomainScoreStale,
  refreshDomainScore,
  getDomainScore,
} from "@/lib/scores";
import type { DomainScore } from "@/lib/scores";
import { enqueueSql, resetSql, sqlCalls } from "../helpers/sql";

vi.mock("@/lib/reputation", () => ({
  cachedFirstCertAt: vi.fn(async () => null),
}));
import { cachedFirstCertAt } from "@/lib/reputation";
const cachedFirstCertAtMock = vi.mocked(cachedFirstCertAt);

beforeEach(() => {
  resetSql();
  cachedFirstCertAtMock.mockReset();
  cachedFirstCertAtMock.mockResolvedValue(null);
});

const score = (over: Partial<DomainScore> = {}): DomainScore => ({
  verified_event_count: 0,
  counterparty_count: 0,
  mutual_counterparties: 0,
  diversity: 0,
  tenure_days: 0,
  trust_index: 0,
  computed_at: new Date().toISOString(),
  ...over,
});

describe("FREE_MAIL_DOMAINS", () => {
  it("contains the big consumer providers", () => {
    for (const d of ["gmail.com", "outlook.com", "yahoo.com", "proton.me"]) {
      expect(FREE_MAIL_DOMAINS.has(d)).toBe(true);
    }
  });
});

describe("computeTrustIndex", () => {
  it("returns 0 for a zero-signal domain", () => {
    expect(
      computeTrustIndex({
        verified_event_count: 0,
        mutual_counterparties: 0,
        diversity: 0,
        tenure_days: 0,
      }),
    ).toBe(0);
  });

  it("saturates near 100 when every signal is maxed", () => {
    const t = computeTrustIndex({
      verified_event_count: 10_000,
      mutual_counterparties: 50,
      diversity: 1,
      tenure_days: 5000,
    });
    expect(t).toBeGreaterThanOrEqual(99);
    expect(t).toBeLessThanOrEqual(100);
  });

  it("weights mutuality heavier per unit than activity alone", () => {
    const activityOnly = computeTrustIndex({
      verified_event_count: 200,
      mutual_counterparties: 0,
      diversity: 0,
      tenure_days: 0,
    });
    const withMutuals = computeTrustIndex({
      verified_event_count: 200,
      mutual_counterparties: 20,
      diversity: 0,
      tenure_days: 0,
    });
    expect(withMutuals).toBeGreaterThan(activityOnly);
  });

  it("clamps negative diversity to 0 rather than dragging score down", () => {
    const clamped = computeTrustIndex({
      verified_event_count: 0,
      mutual_counterparties: 0,
      diversity: -1,
      tenure_days: 0,
    });
    expect(clamped).toBe(0);
  });

  it("activity grows sub-linearly (log curve)", () => {
    const small = computeTrustIndex({
      verified_event_count: 10,
      mutual_counterparties: 0,
      diversity: 0,
      tenure_days: 0,
    });
    const big = computeTrustIndex({
      verified_event_count: 1000,
      mutual_counterparties: 0,
      diversity: 0,
      tenure_days: 0,
    });
    // Doubling scale should add diminishing return, not proportional.
    expect(big).toBeLessThan(small * 5);
  });
});

describe("computeVerified", () => {
  it("grants score-based verification at the threshold", () => {
    const r = computeVerified(
      score({ trust_index: VERIFIED_INDEX, mutual_counterparties: MIN_MUTUALS }),
      false,
    );
    expect(r).toEqual({ isVerified: true, reason: "score" });
  });

  it("denies when mutuality is below the floor even with a perfect score", () => {
    const r = computeVerified(
      score({ trust_index: 99, mutual_counterparties: MIN_MUTUALS - 1 }),
      false,
    );
    expect(r).toEqual({ isVerified: false, reason: null });
  });

  it("denies when trust index is below the threshold even with high mutuality", () => {
    const r = computeVerified(
      score({
        trust_index: VERIFIED_INDEX - 1,
        mutual_counterparties: MIN_MUTUALS * 10,
      }),
      false,
    );
    expect(r).toEqual({ isVerified: false, reason: null });
  });

  it("grandfathers when no score is present", () => {
    expect(computeVerified(null, true)).toEqual({
      isVerified: true,
      reason: "grandfathered",
    });
  });

  it("prefers score-based reason over grandfather when both apply", () => {
    const r = computeVerified(
      score({ trust_index: 90, mutual_counterparties: 10 }),
      true,
    );
    expect(r.isVerified).toBe(true);
    expect(r.reason).toBe("score");
  });

  it("returns false for a null score with no grandfather", () => {
    expect(computeVerified(null, false)).toEqual({
      isVerified: false,
      reason: null,
    });
  });
});

describe("trustTierFromScore", () => {
  it("returns verified when the gate passes", () => {
    expect(
      trustTierFromScore(score(), { isVerified: true, reason: "score" }),
    ).toBe("verified");
  });

  it("returns onRecord when verified_event_count > 0 but not yet verified", () => {
    expect(
      trustTierFromScore(score({ verified_event_count: 3 }), {
        isVerified: false,
        reason: null,
      }),
    ).toBe("onRecord");
  });

  // The legacy "pending" tier was collapsed into "onRecord" on every
  // public surface — once a domain has a row in our DB, we surface
  // "Building" regardless of whether the first DKIM-verified event has
  // landed yet. The /ops dashboard derives its three-state breakdown
  // directly from raw counts; everything else is binary.
  it("returns onRecord when the domain has no verified events yet", () => {
    expect(
      trustTierFromScore(score(), { isVerified: false, reason: null }),
    ).toBe("onRecord");
  });

  it("returns onRecord when no score exists at all", () => {
    expect(
      trustTierFromScore(null, { isVerified: false, reason: null }),
    ).toBe("onRecord");
  });
});

describe("markDomainScoreStale", () => {
  it("emits a single upsert against domain_scores", async () => {
    enqueueSql([]);
    await markDomainScoreStale(42);
    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]?.values).toContain(42);
  });

  it("swallows DB errors so inbound never fails on a cache-flag write", async () => {
    enqueueSql(new Error("boom"));
    await expect(markDomainScoreStale(1)).resolves.toBeUndefined();
  });
});

describe("refreshDomainScore", () => {
  it("returns null when the aggregate query errors", async () => {
    enqueueSql(new Error("agg failed"));
    const r = await refreshDomainScore(1, "acme.com");
    expect(r).toBeNull();
  });

  it("computes, persists, and returns a DomainScore on the happy path", async () => {
    const aggRow = {
      verified_event_count: 50,
      counterparty_count: 10,
      mutual_counterparties: 4,
      diversity: 0.7,
      tenure_days: 180,
    };
    enqueueSql([aggRow]); // aggregate()
    enqueueSql([]); // persist upsert

    const r = await refreshDomainScore(1, "acme.com");
    expect(r).not.toBeNull();
    expect(r?.verified_event_count).toBe(50);
    expect(r?.mutual_counterparties).toBe(4);
    expect(r?.trust_index).toBeGreaterThan(0);
    expect(r?.trust_index).toBeLessThanOrEqual(100);
  });

  it("uses CT-log tenure when it exceeds the first_seen tenure", async () => {
    const aggRow = {
      verified_event_count: 10,
      counterparty_count: 3,
      mutual_counterparties: 1,
      diversity: 0.4,
      tenure_days: 30,
    };
    enqueueSql([aggRow]);
    enqueueSql([]);
    // Cert issued 2 years ago.
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    cachedFirstCertAtMock.mockResolvedValue(twoYearsAgo);

    const r = await refreshDomainScore(1, "acme.com");
    expect(r?.tenure_days).toBeGreaterThanOrEqual(720);
  });

  it("keeps first_seen tenure when CT-log cache is empty", async () => {
    const aggRow = {
      verified_event_count: 10,
      counterparty_count: 3,
      mutual_counterparties: 1,
      diversity: 0.4,
      tenure_days: 30,
    };
    enqueueSql([aggRow]);
    enqueueSql([]);
    cachedFirstCertAtMock.mockResolvedValue(null);

    const r = await refreshDomainScore(1, "acme.com");
    expect(r?.tenure_days).toBe(30);
  });

  it("still returns the score even if CT cache throws", async () => {
    enqueueSql([
      {
        verified_event_count: 1,
        counterparty_count: 1,
        mutual_counterparties: 0,
        diversity: 0,
        tenure_days: 1,
      },
    ]);
    enqueueSql([]);
    cachedFirstCertAtMock.mockRejectedValue(new Error("cache read failed"));
    const r = await refreshDomainScore(1, "acme.com");
    expect(r).not.toBeNull();
  });

  it("returns null when the persist INSERT fails", async () => {
    enqueueSql([
      {
        verified_event_count: 1,
        counterparty_count: 1,
        mutual_counterparties: 0,
        diversity: 0,
        tenure_days: 1,
      },
    ]);
    enqueueSql(new Error("persist failed"));
    const r = await refreshDomainScore(1, "acme.com");
    expect(r).toBeNull();
  });

  it("returns null when aggregate returns an empty row set", async () => {
    enqueueSql([]);
    const r = await refreshDomainScore(99, "none.com");
    expect(r).toBeNull();
  });
});

describe("cold-start — DATABASE_URL unset", () => {
  it("markDomainScoreStale swallows the throw-from-sql-wrapper", async () => {
    vi.resetModules();
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.STORAGE_URL;
    const mod = await import("@/lib/scores");
    await expect(mod.markDomainScoreStale(1)).resolves.toBeUndefined();
    process.env.DATABASE_URL = prev;
  });
});

describe("getDomainScore", () => {
  it("returns the cached row when fresh and non-stale", async () => {
    const freshRow = {
      verified_event_count: 5,
      counterparty_count: 3,
      mutual_counterparties: 2,
      diversity: 0.5,
      tenure_days: 10,
      trust_index: 30,
      stale: false,
      computed_at: new Date().toISOString(),
    };
    enqueueSql([freshRow]);
    const r = await getDomainScore(1, "acme.com");
    expect(r?.trust_index).toBe(30);
  });

  it("recomputes when the cached row is stale", async () => {
    const staleRow = {
      verified_event_count: 5,
      counterparty_count: 3,
      mutual_counterparties: 2,
      diversity: 0.5,
      tenure_days: 10,
      trust_index: 30,
      stale: true,
      computed_at: new Date().toISOString(),
    };
    enqueueSql([staleRow]);
    enqueueSql([
      {
        verified_event_count: 7,
        counterparty_count: 4,
        mutual_counterparties: 3,
        diversity: 0.6,
        tenure_days: 15,
      },
    ]);
    enqueueSql([]);

    const r = await getDomainScore(1, "acme.com");
    expect(r?.verified_event_count).toBe(7);
  });

  it("recomputes when the cached row is too old", async () => {
    const oldRow = {
      verified_event_count: 5,
      counterparty_count: 3,
      mutual_counterparties: 2,
      diversity: 0.5,
      tenure_days: 10,
      trust_index: 30,
      stale: false,
      computed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    enqueueSql([oldRow]);
    enqueueSql([
      {
        verified_event_count: 7,
        counterparty_count: 4,
        mutual_counterparties: 3,
        diversity: 0.6,
        tenure_days: 15,
      },
    ]);
    enqueueSql([]);

    const r = await getDomainScore(1, "acme.com");
    expect(r?.verified_event_count).toBe(7);
  });

  it("falls through to refresh when the read fails", async () => {
    enqueueSql(new Error("read failed"));
    enqueueSql([
      {
        verified_event_count: 1,
        counterparty_count: 1,
        mutual_counterparties: 0,
        diversity: 0,
        tenure_days: 0,
      },
    ]);
    enqueueSql([]);
    const r = await getDomainScore(1, "acme.com");
    expect(r).not.toBeNull();
  });

  it("recomputes when there is no cached row at all", async () => {
    enqueueSql([]); // getDomainScore read → no rows
    enqueueSql([
      {
        verified_event_count: 2,
        counterparty_count: 2,
        mutual_counterparties: 0,
        diversity: 0,
        tenure_days: 3,
      },
    ]);
    enqueueSql([]); // persist
    const r = await getDomainScore(1, "acme.com");
    expect(r?.verified_event_count).toBe(2);
  });
});
