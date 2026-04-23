import { STORAGE_KEYS } from "./lib/constants";

/**
 * Seed defaults on install so the popup shows "on" the very first time it's
 * opened, before any content script has had a chance to run.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.sync.get([STORAGE_KEYS.enabled]);
  if (typeof existing[STORAGE_KEYS.enabled] !== "boolean") {
    await chrome.storage.sync.set({ [STORAGE_KEYS.enabled]: true });
  }
  if (details.reason === "install") {
    await chrome.storage.sync.set({ [STORAGE_KEYS.injected]: 0 });
  }
});
