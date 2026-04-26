/**
 * Single source of truth for every link into the browser extension.
 *
 * The extension ID is assigned by the Chrome Web Store on first publish and
 * is stable for the lifetime of the listing. The type stays `| null` so
 * that if Chrome ever takes the listing down (policy review, account
 * issue) we can flip the ID to null and `/setup` automatically degrades
 * to the "coming soon" copy instead of shipping a dead Install button.
 * `chrome.runtime.sendMessage` against `null` is a cheap no-op, so the
 * install-detection probe in `InstallState` reports "not installed"
 * cleanly in that fallback branch.
 *
 * The store URL is built from the ID so there's only one place to edit
 * if we ever migrate listings.
 */

/** Chrome Web Store extension ID — published 2026-04. */
export const EXTENSION_ID: string | null = "iaicdleiecpkmdnbhpaknphegkchpgaj";

export const CHROME_STORE_URL: string | null = EXTENSION_ID
  ? `https://chromewebstore.google.com/detail/${EXTENSION_ID}`
  : null;
