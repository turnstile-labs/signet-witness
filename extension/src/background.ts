import { STORAGE_KEYS, WITNESSED_HOME } from "./lib/constants";

/**
 * Seed defaults on install so the popup shows "on" the very first time it's
 * opened, before any content script has had a chance to run. Also open a
 * short welcome page on first install so the user lands somewhere that
 * explains what just happened — standard practice and smooth onboarding.
 *
 * Updates (`reason === "update"`) are intentionally silent; nobody wants a
 * new tab every time Chrome auto-updates an extension.
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

  if (details.reason === "install") {
    void chrome.tabs.create({ url: `${WITNESSED_HOME}/extension/welcome` });
  }
});

/**
 * External RPC from witnessed.cc — the site pings us to learn whether the
 * extension is installed. Declared in the manifest via
 * `externally_connectable.matches: ["https://witnessed.cc/*"]`, so only
 * pages on that origin can reach this handler.
 *
 * The site sends `{ kind: "PING" }`; we reply with the manifest version so
 * the site can also show "Installed · <version>" if it ever wants to.
 */
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg && typeof msg === "object" && msg.kind === "PING") {
    sendResponse({
      installed: true,
      version: chrome.runtime.getManifest().version,
    });
    return true;
  }
  return false;
});
