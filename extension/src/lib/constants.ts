/**
 * Single source of truth for the seal address, homepage, and user-visible
 * product name. Updating the address here rewires every content script and
 * popup label on the next build.
 */
export const SEAL_ADDRESS = "seal@witnessed.cc";
export const WITNESSED_HOME = "https://witnessed.cc";
export const SETUP_URL = "https://witnessed.cc/setup";
export const PRODUCT_NAME = "Witnessed";

/** Minimum milliseconds between repeated BCC injections on the same compose. */
export const COMPOSE_DEBOUNCE_MS = 400;

/** chrome.storage.sync keys. Bump the prefix if the schema ever changes. */
export const STORAGE_KEYS = {
  enabled: "w.enabled",
  injected: "w.injectedCount",
} as const;
