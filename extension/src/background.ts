import { STORAGE_KEYS } from "./lib/constants";

/**
 * Seed defaults on install so the popup shows "on" the very first time it's
 * opened, before any content script has had a chance to run.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.sync.get([STORAGE_KEYS.enabled]);
  const seed: Record<string, boolean | number> = {};
  if (typeof existing[STORAGE_KEYS.enabled] !== "boolean") {
    seed[STORAGE_KEYS.enabled] = true;
  }
  if (details.reason === "install") {
    seed[STORAGE_KEYS.injected] = 0;
  }
  if (Object.keys(seed).length > 0) await chrome.storage.sync.set(seed);
});
