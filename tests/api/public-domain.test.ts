import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getDomain: vi.fn(),
  getReceiverCount: vi.fn(),
  isDenylisted: vi.fn(),
}));

vi.mock("@/lib/trust", async () => {
  const actual = await vi.importActual<typeof import("@/lib/trust")>(
    "@/lib/trust",
  );
  return {
    ...actual,
    getDomainMetrics: vi.fn(),
  };
});

import { getDomain, getReceiverCount, isDenylisted } from "@/lib/db";
import { getDomainMetrics } from "@/lib/trust";
import { GET, OPTIONS } from "@/app/api/public/domain/[domain]/route";

const getDomainMock = vi.mocked(getDomain);
const getReceiverCountMock = vi.mocked(getReceiverCount);
const isDenylistedMock = vi.mocked(isDenylisted);
const getDomainMetricsMock = vi.mocked(getDomainMetrics);

function params(domain: string) {
  return { params: Promise.resolve({ domain }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  isDenylistedMock.mockResolvedValue(false);
  getReceiverCountMock.mockResolvedValue(0);
});

describe("GET /api/public/domain/[domain]", () => {
  it("rejects malformed domains with 400", async () => {
    const res = await GET(new Request("http://t"), params("not-a-domain"));
    expect(res.status).toBe(400);
  });

  it("returns `unclaimed` with zero data for a denylisted domain", async () => {
    isDenylistedMock.mockResolvedValue(true);
    // getDomain should never be consulted for denylisted domains — we
    // don't want to leak the fact of an opt-out through a timing side
    // channel either.
    getDomainMock.mockRejectedValue(new Error("should not be called"));
    const res = await GET(new Request("http://t"), params("acme.com"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state).toBe("unclaimed");
    expect(body.trustIndex).toBeNull();
    expect(body.verifiedEventCount).toBe(0);
    expect(getDomainMock).not.toHaveBeenCalled();
  });

  it("returns `unclaimed` with inbound count for a receiver-only domain", async () => {
    getDomainMock.mockResolvedValue(null);
    getReceiverCountMock.mockResolvedValue(7);
    const res = await GET(new Request("http://t"), params("new.com"));
    const body = await res.json();
    expect(body.state).toBe("unclaimed");
    expect(body.inboundCount).toBe(7);
    expect(body.firstSeen).toBeNull();
  });

  it("returns `building` for a claimed domain with no quality events yet", async () => {
    getDomainMock.mockResolvedValue({
      id: 1,
      domain: "acme.com",
      first_seen: "2026-04-20T00:00:00Z",
      event_count: 1,
      tier: "free",
      grandfathered_verified: false,
      updated_at: "2026-04-23T00:00:00Z",
    });
    getDomainMetricsMock.mockResolvedValue({
      verified_event_count: 0,
      counterparty_count: 0,
      mutual_counterparties: 0,
      diversity: 0,
      tenure_days: 3,
      trust_index: 8,
      computed_at: "2026-04-23T00:00:00Z",
    });
    const res = await GET(new Request("http://t"), params("acme.com"));
    const body = await res.json();
    expect(body.state).toBe("building");
    expect(body.trustIndex).toBe(8);
    expect(body.firstSeen).toBe("2026-04-20T00:00:00Z");
  });

  it("returns `building` for a claimed domain below the verified bar", async () => {
    getDomainMock.mockResolvedValue({
      id: 1,
      domain: "acme.com",
      first_seen: "2026-01-01T00:00:00Z",
      event_count: 40,
      tier: "free",
      grandfathered_verified: false,
      updated_at: "2026-04-23T00:00:00Z",
    });
    getDomainMetricsMock.mockResolvedValue({
      verified_event_count: 40,
      counterparty_count: 8,
      mutual_counterparties: 1,
      diversity: 0.5,
      tenure_days: 110,
      trust_index: 55,
      computed_at: "2026-04-23T00:00:00Z",
    });
    const res = await GET(new Request("http://t"), params("acme.com"));
    const body = await res.json();
    expect(body.state).toBe("building");
    expect(body.mutualCounterparties).toBe(1);
  });

  it("returns `verified` once both thresholds are met", async () => {
    getDomainMock.mockResolvedValue({
      id: 1,
      domain: "acme.com",
      first_seen: "2025-01-01T00:00:00Z",
      event_count: 200,
      tier: "free",
      grandfathered_verified: false,
      updated_at: "2026-04-23T00:00:00Z",
    });
    getDomainMetricsMock.mockResolvedValue({
      verified_event_count: 180,
      counterparty_count: 24,
      mutual_counterparties: 8,
      diversity: 0.9,
      tenure_days: 450,
      trust_index: 78,
      computed_at: "2026-04-23T00:00:00Z",
    });
    const res = await GET(new Request("http://t"), params("acme.com"));
    const body = await res.json();
    expect(body.state).toBe("verified");
    expect(body.trustIndex).toBe(78);
  });

  it("sets wide-open CORS and edge-cache headers", async () => {
    getDomainMock.mockResolvedValue(null);
    const res = await GET(new Request("http://t"), params("somewhere.com"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=300/);
  });

  it("lowercases and trims the domain before lookup", async () => {
    getDomainMock.mockResolvedValue(null);
    await GET(new Request("http://t"), params("  ACME.COM  "));
    expect(getDomainMock).toHaveBeenCalledWith("acme.com");
  });
});

describe("OPTIONS /api/public/domain/[domain]", () => {
  it("replies 204 with CORS headers for preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
