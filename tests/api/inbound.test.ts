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
      "x-witnessed-secret": "test-inbound-secret",
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
    const res = await POST(makeReq(raw(), { "x-witnessed-secret": "nope" }));
    expect(res.status).toBe(401);
  });

  it("rejects the legacy x-signet-secret header (migration closed)", async () => {
    // Sanity check that the legacy alias really is gone — if the
    // worker ever falls back to the old name it should now fail
    // closed instead of silently authenticating.
    const req = new NextRequest("https://witnessed.cc/api/inbound", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-signet-secret": "test-inbound-secret",
      },
      body: raw(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400s on empty body", async () => {
    const req = new NextRequest("https://witnessed.cc/api/inbound", {
      method: "POST",
      headers: { "x-witnessed-secret": "test-inbound-secret" },
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

  it("drops solo-recipient mail (no To/Cc counterparty) as a throttle", async () => {
    // Mail with no To or CC lines — i.e. seal@ was the only addressee,
    // so there's no proof-of-business event to record.
    const onlyFrom = [
      "From: <ceo@acme.com>",
      "Subject: hi",
      "",
      "body",
    ].join("\r\n");
    const res = await POST(makeReq(onlyFrom));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, dropped: "solo_recipient" });
    // Receiver-side gates and the public ledger never get touched.
    expect(mxMock).not.toHaveBeenCalled();
    expect(dblMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(throttledMock).toHaveBeenCalledWith(
      "acme.com",
      "unknown",
      expect.any(String),
      "solo_recipient",
    );
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

describe("/api/inbound — free-mail sender rejection", () => {
  // Multi-tenant mailbox providers can't be a seal subject because
  // there's no single owner who can speak for the domain. The intake
  // refuses them at the sender boundary so we never spin up a /b/gmail.com
  // page that would conflate millions of unrelated humans.
  it.each([
    "ceo@gmail.com",
    "alice@outlook.com",
    "bob@icloud.com",
    "x@yahoo.com",
    "y@proton.me",
  ])("drops a sender at %s with reason freemail_sender", async (from) => {
    const res = await POST(makeReq(raw({ from })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      dropped: "freemail_sender",
    });
    const senderDomain = from.split("@")[1];
    expect(throttledMock).toHaveBeenCalledWith(
      senderDomain,
      "unknown",
      expect.any(String),
      "freemail_sender",
    );
    // No DB writes, no domain row created, no receiver-side checks
    // — the gate is structurally above all of those.
    expect(insertMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(mxMock).not.toHaveBeenCalled();
    expect(dblMock).not.toHaveBeenCalled();
  });

  it("normalizes case before matching — From: 'Ceo@Gmail.COM' is still rejected", async () => {
    const res = await POST(makeReq(raw({ from: "Ceo@Gmail.COM" })));
    expect((await res.json()).dropped).toBe("freemail_sender");
  });

  it("free-mail RECEIVERS still flow through to the public ledger", async () => {
    // Asymmetry test: only the SENDER side is gated. acme.com → alice@gmail.com
    // is real signal for acme.com and must record normally.
    const res = await POST(
      makeReq(raw({ from: "ceo@acme.com", to: "alice@gmail.com" })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith(
      1,
      "gmail.com",
      expect.any(String),
    );
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

  it("excludes the sender's own domain from the primary receiver", async () => {
    // First parsed To/CC domain that isn't the sender becomes
    // primaryReceiver. Here internal@acme.com is the sender's own
    // domain (acme.com) so it's stripped; victim.example wins. The
    // ops@witnessed.cc address is *not* the seal endpoint
    // (seal@witnessed.cc), so it's kept as a counterparty too — but
    // it's third in the To order, so it doesn't become primary.
    await POST(
      makeReq(
        raw({
          to: "internal@acme.com, partner@victim.example, ops@witnessed.cc",
        }),
      ),
    );
    expect(insertMock).toHaveBeenCalledWith(1, "victim.example", expect.any(String));
  });

  it("strips seal@witnessed.cc but keeps other @witnessed.cc addresses as counterparties", async () => {
    // Regression test for the solo_recipient bug: when a counterparty
    // replies to hello@witnessed.cc (a real human inbox) with seal@
    // also Bcc'd, the seal address gets stripped but hello@ stays as
    // the counterparty, so the event records witnessed.cc as the
    // primary receiver instead of falling through to "unknown" and
    // tripping the solo_recipient gate.
    upsertMock.mockResolvedValueOnce({
      id: 7,
      domain: "randomthoughtsls.com",
      event_count: 1,
      first_seen: new Date().toISOString(),
      tier: "free",
      grandfathered_verified: false,
      updated_at: new Date().toISOString(),
    });
    await POST(
      makeReq(
        raw({
          from: "yudit@randomthoughtsls.com",
          to: "hello@witnessed.cc",
        }),
      ),
    );
    expect(throttledMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(7, "witnessed.cc", expect.any(String));
  });

  it("solo_recipient gate still fires when seal@ is the only addressee", async () => {
    // The seal address by itself is *not* a counterparty — it's a
    // platform endpoint. A message addressed only to seal@ has no
    // proof-of-business event to record and should still drop into
    // the throttle table.
    await POST(
      makeReq(
        raw({
          from: "ceo@acme.com",
          to: "seal@witnessed.cc",
        }),
      ),
    );
    expect(throttledMock).toHaveBeenCalledWith(
      "acme.com",
      "unknown",
      expect.any(String),
      "solo_recipient",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});
