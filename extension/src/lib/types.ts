/**
 * Shared types between the content script, background worker, and popup.
 *
 * The DomainState union mirrors the canonical state taxonomy used on
 * /b/[domain] and the public JSON API: three product states plus a
 * transient `error` state so the cache can remember that a lookup
 * failed recently without conflating it with an actual product state.
 *
 * Token names match the user-visible labels exactly ("Verified",
 * "Building") so the codebase and the UI never drift apart.
 *
 * The legacy `pending` tier was collapsed into `building` on every
 * public surface in v12 — the API and seal page never emit it, so the
 * popup never sees it either.
 */

export type DomainState =
  | "verified"
  | "building"
  | "unclaimed"
  | "error";

export interface PublicPayload {
  domain: string;
  state: DomainState;
  trustIndex: number | null;
  verifiedEventCount: number;
  mutualCounterparties: number;
  uniqueReceivers: number;
  inboundCount: number | null;
  firstSeen: string | null;
  updatedAt: string;
}
