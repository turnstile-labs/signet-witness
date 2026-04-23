// Pure helpers for the badge route — no Next.js, no next/og, no
// React. Lives here so unit tests can import the math without
// dragging the entire Satori wasm pipeline into the test runtime.
//
// The route file (app/badge/[slug]/route.tsx) stays a thin shell
// around these primitives.

import { getDomain } from "@/lib/db";
import {
  getDomainScore,
  computeVerified,
  trustTierFromScore,
} from "@/lib/scores";

export type BadgeState = "verified" | "onRecord" | "pending";

export interface BadgeSnapshot {
  state: BadgeState;
  count: number;
  trustIndex: number; // 0..100, drives the ring fraction
}

// Normalise + clamp a raw trust index into the 0..100 space the ring
// draws in. Non-finite → 0 so bad data never breaks the render.
export function ringFraction(trustIndex: number): number {
  if (!Number.isFinite(trustIndex)) return 0;
  return Math.max(0, Math.min(100, Math.round(trustIndex))) / 100;
}

// SVG arc starting at 12 o'clock, sweeping clockwise. Returns an
// empty string for ~0 fractions (avoid a vestigial dot) and a closed
// circle for ~100 (avoid floating-point seam).
export function ringArcPath(
  cx: number,
  cy: number,
  r: number,
  fraction: number,
): string {
  if (fraction <= 0.005) return "";
  if (fraction >= 0.995) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;
  }
  const angle = fraction * 2 * Math.PI;
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
}

// Resolves a domain to the rendered badge state. Mirrors the seal
// page's verified gate (composite trust index + mutuality floor) and
// grandfathers pre-Layer-2 domains so their ring fills completely
// even if the recomputed score hasn't caught up yet.
export async function resolveSnapshot(domain: string): Promise<BadgeSnapshot> {
  try {
    const record = await getDomain(domain);
    if (!record) return { state: "pending", count: 0, trustIndex: 0 };
    const score = await getDomainScore(record.id, record.domain);
    const verified = computeVerified(score, record.grandfathered_verified);
    const tier = trustTierFromScore(score, verified);
    const rawIndex = score?.trust_index ?? 0;
    const trustIndex =
      verified && record.grandfathered_verified
        ? Math.max(rawIndex, 100)
        : rawIndex;
    return { state: tier, count: record.event_count, trustIndex };
  } catch {
    return { state: "pending", count: 0, trustIndex: 0 };
  }
}

// Bucket the trust index into 20 bins (5-point granularity). Keeps
// CDN hit rates high while still letting the ring advance as
// meaningful progress accrues.
export function trustBucket(trustIndex: number): number {
  return Math.floor(ringFraction(trustIndex) * 20);
}
