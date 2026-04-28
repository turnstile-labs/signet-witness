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
 * Consumer-grade free-mail providers.
 *
 * Mirrors `lib/trust.ts#FREE_MAIL_DOMAINS` on the server. Free-mail
 * domains are multi-tenant mailbox providers — there's no single owner
 * we could ever speak to, ever trust, or ever verify, so they're not
 * useful subjects of a Witnessed badge. The server rejects them at
 * intake (no row in `domains`); the extension hides them from the
 * popup so the user doesn't see "checking…" → "Unclaimed" for every
 * gmail.com / outlook.com row in their inbox.
 *
 * Kept inline rather than imported from a shared TS path because the
 * extension and the Next app are separate builds with no cross-import
 * graph today. Drift risk is mitigated by: (a) exact copy of the same
 * set, (b) a unit test that pins the expected providers.
 */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "fastmail.com",
  "tutanota.com",
  "pm.me",
]);

/**
 * True if the given domain is a multi-tenant consumer mail provider.
 * Input is normalised — callers don't need to lower-case or trim first.
 * Returns false for null / undefined / empty input so it composes
 * cleanly with `emailToDomain`.
 */
export function isFreeMailDomain(
  domain: string | null | undefined,
): boolean {
  if (!domain) return false;
  return FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}

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
