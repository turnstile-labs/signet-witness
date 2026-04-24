/**
 * Shared types between the content script, background worker, and popup.
 *
 * The DomainState union mirrors the canonical four-state system used on
 * /b/[domain]. We add `error` as a transient local state so the cache
 * can remember that a lookup failed recently without conflating it with
 * an actual product state.
 */

export type DomainState =
  | "verified"
  | "onRecord"
  | "pending"
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
