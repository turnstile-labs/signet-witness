/**
 * Single source of truth for the seal address, homepage, public API origin,
 * and user-visible product name. Updating these here rewires every content
 * script and popup label on the next build.
 */
export const SEAL_ADDRESS = "seal@witnessed.cc";
export const WITNESSED_HOME = "https://witnessed.cc";
export const API_BASE = "https://witnessed.cc";
export const PRODUCT_NAME = "Witnessed";

/**
 * Cadence of the compose scanner.
 *
 * Earlier builds reacted to Gmail DOM changes via a `MutationObserver`
 * on `document.body` with `subtree: true`. That instruments the entire
 * descendant tree, and Gmail fires thousands of mutations per second on
 * a busy inbox (virtualised list recycling, hovercards, animations).
 * Even with debouncing, the per-mutation dispatch overhead alone was
 * enough to wedge Gmail's renderer on large inboxes — visible to the
 * user as Gmail freezing and the popup never reaching the content
 * script.
 *
 * A 1 s polling cadence gives the user "BCC the seal as soon as they
 * open compose" within a tick they don't notice (humans don't perceive
 * sub-second auto-fills as latency), while putting a hard ceiling on
 * how much main-thread time we can ever burn on a Gmail tab.
 */
export const COMPOSE_POLL_MS = 1000;

/** Per-domain cache TTLs for the popup's sender lookup.
 *  Verified / Building states are sticky — a verified domain won't flip
 *  back within a day, so we keep them a full day. Unclaimed can upgrade
 *  on the next sealed email so it caches shorter, giving the popup a
 *  chance to surface an upgrade promptly. */
export const CACHE_TTL_MS = {
  verified: 24 * 60 * 60 * 1000,
  building: 12 * 60 * 60 * 1000,
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
