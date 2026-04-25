import { API_BASE } from "./constants";
import { readCache, writeCache, writeErrorMarker } from "./cache";
import type { DomainState, PublicPayload } from "./types";

/**
 * Domain-state fetcher with per-domain cache and in-flight deduplication.
 *
 * Gmail can ask for the same sender domain dozens of times within one
 * inbox view (multiple threads from the same sender, pagination, etc.).
 * The `inFlight` map makes sure we fire exactly one network request per
 * unique domain until that request settles, then all waiters share the
 * result. Subsequent calls within the TTL come straight from cache.
 */

const VALID_STATES: ReadonlySet<DomainState> = new Set([
  "verified",
  "building",
  "unclaimed",
  "error",
]);

const inFlight = new Map<string, Promise<PublicPayload>>();

function isPayload(x: unknown): x is PublicPayload {
  if (!x || typeof x !== "object") return false;
  const p = x as { domain?: unknown; state?: unknown };
  return typeof p.domain === "string" && typeof p.state === "string" &&
    VALID_STATES.has(p.state as DomainState);
}

async function fetchFresh(domain: string): Promise<PublicPayload> {
  const url = `${API_BASE}/api/public/domain/${encodeURIComponent(domain)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "default",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data: unknown = await res.json();
    if (!isPayload(data)) throw new Error("invalid payload");
    await writeCache(domain, data);
    return data;
  } catch (err) {
    await writeErrorMarker(domain);
    throw err;
  }
}

/**
 * Get the current state for a domain, hitting cache first. The cache
 * may return an `error` marker — callers should treat that as "skip the
 * pill entirely," not as a product state.
 */
export async function lookupDomain(domain: string): Promise<PublicPayload> {
  const cached = await readCache(domain);
  if (cached) return cached.payload;

  const existing = inFlight.get(domain);
  if (existing) return existing;

  const p = fetchFresh(domain).finally(() => inFlight.delete(domain));
  inFlight.set(domain, p);
  return p;
}
