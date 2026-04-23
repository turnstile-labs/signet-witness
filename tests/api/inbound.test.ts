import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock every external side-effect so the route's anti-abuse decision
// tree is the thing under test.
vi.mock("mailauth", () => ({
  authenticate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  upsertDomain: vi.fn(async () => ({ id: 1, domain: "acme.com" })),
  insertEvent: vi.fn(async () => {}),
  isDenylisted: vi.fn(async () => false),
}));
vi.mock("@/lib/reputation", () => ({
  receiverHasMx: vi.fn(async () => true),
  isOnDbl: vi.fn(async () => false),
  isRateLimited: vi.fn(async () => false),
  recordThrottled: vi.fn(async () => {}),
  fetchFirstCertAt: vi.fn(async () => null),
}));

// Next's `after()` runs post-response in prod. In tests we just
// flush it synchronously so we can assert on its side effects.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: (fn: () => unknown) => {
      // fire-and-store — tests can await manually if needed.
      queueMicrotask(() => {
        void fn();
      });
    },
  };
});

import { authenticate } from "mailauth";
import {
  upsertDomain,
  insertEvent,
  isDenylisted,
} from "@/lib/db";
import {
  receiverHasMx,
  isOnDbl,
  isRateLimited,
  recordThrottled,
  fetchFirstCertAt,
} from "@/lib/reputation";
import { POST } from "@/app/api/inbound/route";

// Types from mailauth / the DB layer are strict in source but
// we only exercise a narrow slice of their shape here. Loosen to
// unknown so tests can return partials without mirroring every field.
const authMock = vi.mocked(authenticate) as unknown as {
  mockResolvedValue: (v: unknown) => void;
  mockRejectedValue: (e: unknown) => void;
};
const upsertMock = vi.mocked(upsertDomain);
const insertMock = vi.mocked(insertEvent) as unknown as {
  mockResolvedValue: (v: unknown) => void;
  mockRejectedValue: (e: unknown) => void;
};
const denyMock = vi.mocked(isDenylisted);
const mxMock = vi.mocked(receiverHasMx);
const dblMock = vi.mocked(isOnDbl);
const rateMock = vi.mocked(isRateLimited);
const throttledMock = vi.mocked(recordThrottled);
const ctMock = vi.mocked(fetchFirstCertAt);

function raw(overrides: Partial<{ from: string; to: string; body: string }> = {}): string {
  const from = overrides.from ?? "ceo@acme.com";
  const to = overrides.to ?? "partner@victim.example";
  const body = overrides.body ?? "hello";
  return [
    `From: <${from}>`,
    `To: ${to}`,
    `Subject: hi`,
    ``,
    body,
  ].join("\r\n");
}

function makeReq(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://witnessed.cc/api/inbound", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "x-signet-secret": "test-inbound-secret",
      ...headers,
    },
    body,
  });
}

function passingDkim() {
  return {
    dkim: {
      results: [
        { status: { result: "pass" }, signature: "sig-base64" },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(passingDkim());
  upsertMock.mockResolvedValue({
    id: 1,
    domain: "acme.com",
    event_count: 1,
    first_seen: new Date().toISOString(),
    tier: "free",
    grandfathered_verified: false,
    updated_at: new Date().toISOString(),
  });
  insertMock.mockResolvedValue({
    id: 123,
    domain_id: 1,
    receiver_domain: "victim.example",
    dkim_hash: "h",
    witnessed_at: new Date().toISOString(),
  });
  denyMock.mockResolvedValue(false);
  mxMock.mockResolvedValue(true);
  dblMock.mockResolvedValue(false);
  rateMock.mockResolvedValue(false);
  throttledMock.mockResolvedValue();
  ctMock.mockResolvedValue(null);
});

describe("/api/inbound — auth + parsing", () => {
  it("rejects missing secret", async () => {
    const res = await POST(
      new NextRequest("https://witnessed.cc/api/inbound", {
        method: "POST",
        body: raw(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects wrong secret", async () => {
    const res = await POST(makeReq(raw(), { "x-signet-secret": "nope" }));
    expect(res.status).toBe(401);
  });

  it("400s on empty body", async () => {
    const req = new NextRequest("https://witnessed.cc/api/inbound", {
      method: "POST",
      headers: { "x-signet-secret": "test-inbound-secret" },
      body: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400s when DKIM parse throws", async () => {
    authMock.mockRejectedValue(new Error("parse"));
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(400);
  });

  it("200s and no-ops when DKIM has no passing result", async () => {
    authMock.mockResolvedValue({ dkim: { results: [] } });
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("200s and no-ops when sender is witnessed.cc itself", async () => {
    const res = await POST(
      makeReq(raw({ from: "seal@witnessed.cc" })),
    );
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("200s and no-ops when the From line has no parseable domain", async () => {
    const weird = [
      "From: no-valid-address-here",
      "To: partner@victim.example",
      "Subject: hi",
      "",
      "body",
    ].join("\r\n");
    const res = await POST(makeReq(weird));
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("200s and no-ops when there is no From header at all", async () => {
    const noFrom = [
      "To: partner@victim.example",
      "Subject: hi",
      "",
      "body",
    ].join("\r\n");
    const res = await POST(makeReq(noFrom));
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("/api/inbound — GDPR denylist", () => {
  it("drops silently when sender is on the denylist", async () => {
    denyMock.mockImplementation(async (d) => d === "acme.com");
    const res = await POST(makeReq(raw()));
    const body = await res.json();
    expect(body.dropped).toBe("denylist");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("drops silently when primary receiver is on the denylist", async () => {
    denyMock.mockImplementation(async (d) => d === "victim.example");
    const res = await POST(makeReq(raw()));
    const body = await res.json();
    expect(body.dropped).toBe("denylist");
  });

  it("continues when denylist check itself errors (best-effort)", async () => {
    denyMock.mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalled();
  });
});

describe("/api/inbound — anti-abuse decision tree", () => {
  it("throttles when receiver has no MX", async () => {
    mxMock.mockResolvedValue(false);
    const res = await POST(makeReq(raw()));
    const body = await res.json();
    expect(body.dropped).toBe("receiver_no_mx");
    expect(throttledMock).toHaveBeenCalledWith(
      "acme.com",
      "victim.example",
      expect.any(String),
      "receiver_no_mx",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("throttles when receiver is on DBL", async () => {
    dblMock.mockResolvedValue(true);
    const res = await POST(makeReq(raw()));
    const body = await res.json();
    expect(body.dropped).toBe("receiver_blocklist");
    expect(throttledMock).toHaveBeenCalledWith(
      "acme.com",
      "victim.example",
      expect.any(String),
      "receiver_blocklist",
    );
  });

  it("throttles when sender hits the rate limit", async () => {
    rateMock.mockResolvedValue(true);
    const res = await POST(makeReq(raw()));
    const body = await res.json();
    expect(body.dropped).toBe("rate_limit");
    expect(throttledMock).toHaveBeenCalledWith(
      "acme.com",
      "victim.example",
      expect.any(String),
      "rate_limit",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("skips receiver-side gates when primary receiver is 'unknown'", async () => {
    // Mail with no To or CC lines.
    const onlyFrom = [
      "From: <ceo@acme.com>",
      "Subject: hi",
      "",
      "body",
    ].join("\r\n");
    const res = await POST(makeReq(onlyFrom));
    expect(res.status).toBe(200);
    // MX / DBL must not have been queried — there's no receiver.
    expect(mxMock).not.toHaveBeenCalled();
    expect(dblMock).not.toHaveBeenCalled();
  });

  it("accepts the happy path and returns ok", async () => {
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalled();
  });

  it("500s when the DB write fails", async () => {
    insertMock.mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(500);
  });
});

describe("/api/inbound — post-response work", () => {
  it("schedules CT warm-up via after()", async () => {
    await POST(makeReq(raw()));
    // `after` handlers flush on the next microtask; wait a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(ctMock).toHaveBeenCalledWith("acme.com");
  });

  it("swallows CT warm-up failures in the after() handler", async () => {
    ctMock.mockRejectedValue(new Error("crt.sh down"));
    const res = await POST(makeReq(raw()));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    // Didn't throw — response still OK and event was written.
    expect(insertMock).toHaveBeenCalled();
  });

  it("excludes sender's own domain and witnessed.cc from the primary receiver", async () => {
    // First parsed To/CC domain that isn't sender or witnessed.cc
    // becomes primaryReceiver — here that's victim.example.
    await POST(
      makeReq(
        raw({
          to: "internal@acme.com, partner@victim.example, ops@witnessed.cc",
        }),
      ),
    );
    expect(insertMock).toHaveBeenCalledWith(1, "victim.example", expect.any(String));
  });
});
