import { describe, it, expect, vi, afterEach } from "vitest";
import {
  readCache,
  writeCache,
  writeErrorMarker,
  clearCache,
  type CacheEntry,
} from "../src/lib/cache";
import type { PublicPayload } from "../src/lib/types";
import { CACHE_TTL_MS, LOCAL_KEYS } from "../src/lib/constants";

const payload = (over: Partial<PublicPayload> = {}): PublicPayload => ({
  domain: "acme.com",
  state: "verified",
  trustIndex: 80,
  verifiedEventCount: 12,
  mutualCounterparties: 4,
  uniqueReceivers: 6,
  inboundCount: null,
  firstSeen: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cache / writeCache + readCache", () => {
  it("round-trips a freshly written entry", async () => {
    await writeCache("acme.com", payload());
    const cached = await readCache("acme.com");
    expect(cached?.payload.domain).toBe("acme.com");
    expect(cached?.payload.state).toBe("verified");
  });

  it("keys entries with the canonical prefix so clearCache can find them", async () => {
    await writeCache("acme.com", payload());
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all);
    expect(keys.some((k) => k.startsWith(LOCAL_KEYS.cachePrefix))).toBe(true);
  });

  it("derives expiry from the state's TTL", async () => {
    const before = Date.now();
    await writeCache("acme.com", payload({ state: "verified" }));
    const cached = (await readCache("acme.com")) as CacheEntry;
    const elapsed = cached.expiresAt - before;
    // Allow a small margin for clock + write latency.
    expect(elapsed).toBeGreaterThanOrEqual(CACHE_TTL_MS.verified - 50);
    expect(elapsed).toBeLessThanOrEqual(CACHE_TTL_MS.verified + 50);
  });

  it("uses a shorter TTL for unclaimed than verified", async () => {
    expect(CACHE_TTL_MS.unclaimed).toBeLessThan(CACHE_TTL_MS.verified);
  });

  it("evicts entries on read once their expiry passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await writeCache("acme.com", payload({ state: "unclaimed" }));
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    const cached = await readCache("acme.com");
    expect(cached).toBeNull();
    // Entry should have been removed lazily so storage doesn't bloat.
    const all = await chrome.storage.local.get(null);
    expect(Object.keys(all).length).toBe(0);
  });

  it("writeErrorMarker stores a short-TTL `error` placeholder", async () => {
    await writeErrorMarker("flaky.com");
    const cached = await readCache("flaky.com");
    expect(cached?.payload.state).toBe("error");
    const ttl = (cached as CacheEntry).expiresAt - (cached as CacheEntry).fetchedAt;
    expect(ttl).toBe(CACHE_TTL_MS.error);
  });

  it("clearCache removes only entries with the cache prefix", async () => {
    await writeCache("acme.com", payload());
    await chrome.storage.local.set({ "w.unrelated": 42 });
    await clearCache();
    const all = await chrome.storage.local.get(null);
    expect(Object.keys(all)).toEqual(["w.unrelated"]);
  });
});
