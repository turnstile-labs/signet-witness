/**
 * Single source of truth for the seal address, homepage, public API origin,
 * and user-visible product name. Updating these here rewires every content
 * script and popup label on the next build.
 */
export const SEAL_ADDRESS = "seal@witnessed.cc";
export const WITNESSED_HOME = "https://witnessed.cc";
export const API_BASE = "https://witnessed.cc";
export const PRODUCT_NAME = "Witnessed";

/** Minimum milliseconds between repeated BCC injections on the same compose. */
export const COMPOSE_DEBOUNCE_MS = 400;

/** Per-domain cache TTLs for the popup's sender lookup.
 *  Verified / onRecord states are sticky — a verified domain won't flip
 *  back within a day, so we keep them a full day. Pending / unclaimed can
 *  upgrade on the next sealed email, so they cache shorter to give the
 *  popup a chance to surface an upgrade. */
export const CACHE_TTL_MS = {
  verified: 24 * 60 * 60 * 1000,
  onRecord: 12 * 60 * 60 * 1000,
  pending: 60 * 60 * 1000,
  unclaimed: 60 * 60 * 1000,
  error: 5 * 60 * 1000,
} as const;

/** chrome.storage.sync keys. Bump the prefix if the schema ever changes. */
export const STORAGE_KEYS = {
  enabled: "w.enabled",
  injected: "w.injectedCount",
  theme: "w.theme",
} as const;

/** chrome.storage.local is not synced to the cloud — perfect for per-browser
 *  per-domain state caches we don't want to inflate the sync quota with. */
export const LOCAL_KEYS = {
  /** Prefix; full key is `w.cache:<domain>` so we can iterate or clear. */
  cachePrefix: "w.cache:",
} as const;
