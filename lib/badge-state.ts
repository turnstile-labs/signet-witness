// Pure helpers for the badge route — no Next.js, no next/og, no
// React. Lives here so unit tests can import the state resolver
// without dragging the entire Satori wasm pipeline into the test
// runtime.
//
// The route file (app/badge/[slug]/route.tsx) stays a thin shell
// around `resolveSnapshot()` plus the SVG/PNG rendering.

import { getDomain } from "@/lib/db";
import {
  getDomainScore,
  computeVerified,
  trustTierFromScore,
} from "@/lib/scores";

export type BadgeState = "verified" | "building";

export interface BadgeSnapshot {
  state: BadgeState;
  count: number;
}

// Resolves a domain to the rendered badge state. Mirrors the seal
// page's verified gate (composite trust index + mutuality floor) and
// grandfathers pre-Layer-2 domains so their badge shows "Verified"
// even if the recomputed score hasn't caught up yet. Fails closed
// (building, count 0) on any DB error so a flaky connection never
// renders a spuriously verified badge — the badge still resolves,
// just in the conservative "Building" tone.
export async function resolveSnapshot(domain: string): Promise<BadgeSnapshot> {
  try {
    const record = await getDomain(domain);
    if (!record) return { state: "building", count: 0 };
    const score = await getDomainScore(record.id, record.domain);
    const verified = computeVerified(score, record.grandfathered_verified);
    const tier = trustTierFromScore(score, verified);
    return { state: tier, count: record.event_count };
  } catch {
    return { state: "building", count: 0 };
  }
}
