/**
 * Single source of truth for every link into the browser extension.
 *
 * The extension ID is assigned by the Chrome Web Store on first publish and
 * is stable for the lifetime of the listing. Until the listing is live we
 * leave the ID unset — `chrome.runtime.sendMessage` against `null` is a
 * cheap no-op, so install detection simply reports "not installed" instead
 * of blowing up. Fill it in after the first accepted submission.
 *
 * The store URL follows the `chromewebstore.google.com/detail/<slug>/<id>`
 * shape. Without the ID we leave this null; the extension recipe on
 * `/setup` inspects that and renders "coming soon" copy instead of a
 * dead Install button.
 */

/** Chrome Web Store extension ID — populated once the listing is approved. */
export const EXTENSION_ID: string | null = null;

export const CHROME_STORE_URL: string | null = EXTENSION_ID
  ? `https://chromewebstore.google.com/detail/${EXTENSION_ID}`
  : null;

/** Whether the extension listing is live and installable. */
export const EXTENSION_LISTED: boolean = CHROME_STORE_URL !== null;
