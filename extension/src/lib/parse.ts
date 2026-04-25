/**
 * Pure parsing helpers shared between the content script and the popup.
 *
 * These live in their own module so unit tests can exercise them without
 * pulling Gmail's DOM, the chrome.* runtime, or the Vite/CRX build chain
 * into the test environment. The content script imports back from here,
 * so the rules below are the single source of truth for "what counts as
 * a usable sender domain."
 */

/**
 * Extract a normalised domain from a single email address-like string.
 *
 * Gmail surfaces sender addresses in a handful of attributes
 * (`span[email="x@y.com"]`, `[data-hovercard-id="..."]`) which are
 * usually clean but occasionally pad whitespace, mixed-case, or carry
 * the entire `Display Name <addr@host>` form when scraping headers.
 * This helper:
 *   1. Trims whitespace and lower-cases the input.
 *   2. Requires an `@` separator.
 *   3. Requires the right-hand side to look domain-shaped (one dot,
 *      at minimum) so we don't fire lookups against bare hostnames
 *      (`localhost`) or freeform tokens.
 *
 * Returns `null` for any unparseable input — callers should treat null
 * as "skip this row" rather than retrying.
 */
export function emailToDomain(raw: string | null | undefined): string | null {
  const addr = raw?.trim().toLowerCase();
  if (!addr || !addr.includes("@")) return null;
  const domain = addr.split("@", 2)[1];
  if (!domain || !domain.includes(".")) return null;
  return domain;
}
