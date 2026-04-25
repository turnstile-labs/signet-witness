import { CACHE_TTL_MS, LOCAL_KEYS } from "./constants";
import type { DomainState, PublicPayload } from "./types";

/**
 * chrome.storage.local-backed per-domain cache for read-side lookups.
 *
 * Cache entries are keyed `w.cache:<domain>` so we can list/clear them
 * cheaply without walking the entire store, and each entry carries its
 * own expiry so TTL is state-dependent: verified/building stick for a
 * full day; unclaimed expires faster so the popup picks up an upgrade
 * within an hour of the sender getting verified.
 */

export interface CacheEntry {
  payload: PublicPayload;
  fetchedAt: number;
  expiresAt: number;
}

function keyFor(domain: string): string {
  return `${LOCAL_KEYS.cachePrefix}${domain}`;
}

function ttlFor(state: DomainState): number {
  return CACHE_TTL_MS[state] ?? CACHE_TTL_MS.unclaimed;
}

export async function readCache(domain: string): Promise<CacheEntry | null> {
  const key = keyFor(domain);
  const got = await chrome.storage.local.get([key]);
  const entry = got[key] as CacheEntry | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    // Lazy eviction: expired entries are removed on read so the store
    // doesn't grow unbounded across weeks of inbox scanning.
    await chrome.storage.local.remove([key]);
    return null;
  }
  return entry;
}

export async function writeCache(
  domain: string,
  payload: PublicPayload,
): Promise<void> {
  const fetchedAt = Date.now();
  const entry: CacheEntry = {
    payload,
    fetchedAt,
    expiresAt: fetchedAt + ttlFor(payload.state),
  };
  await chrome.storage.local.set({ [keyFor(domain)]: entry });
}

/** Short-TTL negative cache so a failing domain doesn't retry on every row. */
export async function writeErrorMarker(domain: string): Promise<void> {
  const fetchedAt = Date.now();
  const entry: CacheEntry = {
    payload: {
      domain,
      state: "error",
      trustIndex: null,
      verifiedEventCount: 0,
      mutualCounterparties: 0,
      uniqueReceivers: 0,
      inboundCount: null,
      firstSeen: null,
      updatedAt: new Date(fetchedAt).toISOString(),
    },
    fetchedAt,
    expiresAt: fetchedAt + CACHE_TTL_MS.error,
  };
  await chrome.storage.local.set({ [keyFor(domain)]: entry });
}

/** Drop every cached domain lookup. Wired to the popup's "refresh" button. */
export async function clearCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) =>
    k.startsWith(LOCAL_KEYS.cachePrefix),
  );
  if (keys.length > 0) await chrome.storage.local.remove(keys);
}
