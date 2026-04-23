import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { enqueueSql, resetSql } from "../helpers/sql";

vi.mock("@/lib/db", () => ({
  isDenylisted: vi.fn(async () => false),
}));
import { isDenylisted } from "@/lib/db";
const isDenylistedMock = vi.mocked(isDenylisted);

// Import AFTER mocks are registered so the real module picks them up.
import { enqueueViralInvites } from "@/lib/viral";

const fetchSpy = () => vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  resetSql();
  isDenylistedMock.mockReset();
  isDenylistedMock.mockResolvedValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Each candidate flows:
//   alreadyRegistered (1 SQL) → alreadyInvited (1 SQL) → send (1 fetch)
//   → recordInvite (1 SQL)
// Test enqueues mirror that order.

describe("enqueueViralInvites — gating", () => {
  it("no-ops when the recipient list is empty", async () => {
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", []);
    expect(f).not.toHaveBeenCalled();
  });

  it("skips gmail and other free-mail domains entirely", async () => {
    const f = fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "id1" }), { status: 200 }),
    );
    await enqueueViralInvites("acme.com", [
      { email: "x@gmail.com", domain: "gmail.com" },
      { email: "y@yahoo.com", domain: "yahoo.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("skips denylisted recipient domains (GDPR opt-out)", async () => {
    isDenylistedMock.mockResolvedValueOnce(true);
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "ceo@optedout.com", domain: "optedout.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("skips recipients whose domain is already a registered sender", async () => {
    // alreadyRegistered sees 1 row — they're a customer.
    enqueueSql([{ "?column?": 1 }]);
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "cto@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("skips when the (sender, email) pair was previously invited", async () => {
    enqueueSql([]); // alreadyRegistered → false
    enqueueSql([{ "?column?": 1 }]); // alreadyInvited → true
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "cto@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("deduplicates the same email within one batch", async () => {
    enqueueSql([]); // alreadyRegistered
    enqueueSql([]); // alreadyInvited
    enqueueSql([]); // recordInvite
    const f = fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "id1" }), { status: 200 }),
    );
    await enqueueViralInvites("acme.com", [
      { email: "cto@partner.com", domain: "partner.com" },
      { email: "cto@partner.com", domain: "partner.com" },
    ]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("caps the number of invites per event", async () => {
    for (let i = 0; i < 3; i++) {
      enqueueSql([]); // registered
      enqueueSql([]); // invited
      enqueueSql([]); // record
    }
    const f = fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "id" }), { status: 200 }),
    );
    await enqueueViralInvites(
      "acme.com",
      Array.from({ length: 8 }, (_, i) => ({
        email: `r${i}@partner${i}.com`,
        domain: `partner${i}.com`,
      })),
    );
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("skips rows with missing email or domain", async () => {
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "", domain: "partner.com" },
      { email: "a@b.com", domain: "" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("enqueueViralInvites — sending", () => {
  it("records 'sent' with the resend id on a 200 response", async () => {
    enqueueSql([]); // alreadyRegistered
    enqueueSql([]); // alreadyInvited
    enqueueSql([]); // recordInvite
    fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "resend-abc" }), { status: 200 }),
    );

    await enqueueViralInvites("acme.com", [
      { email: "cto@partner.com", domain: "partner.com" },
    ]);

    // Last SQL call is the recordInvite upsert — inspect the values.
    const { sqlCalls } = await import("../helpers/sql");
    const last = sqlCalls[sqlCalls.length - 1];
    expect(last.values).toContain("sent");
    expect(last.values).toContain("resend-abc");
  });

  it("records 'failed' when Resend returns non-2xx", async () => {
    enqueueSql([]);
    enqueueSql([]);
    enqueueSql([]);
    fetchSpy().mockResolvedValue(
      new Response("limit exceeded", { status: 429 }),
    );
    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    const { sqlCalls } = await import("../helpers/sql");
    const last = sqlCalls[sqlCalls.length - 1];
    expect(last.values).toContain("failed");
  });

  it("records 'failed' when fetch throws", async () => {
    enqueueSql([]);
    enqueueSql([]);
    enqueueSql([]);
    fetchSpy().mockRejectedValue(new Error("ECONNRESET"));
    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    const { sqlCalls } = await import("../helpers/sql");
    const last = sqlCalls[sqlCalls.length - 1];
    expect(last.values).toContain("failed");
  });

  it("accepts a 200 response with no id field (records sent with null id)", async () => {
    enqueueSql([]);
    enqueueSql([]);
    enqueueSql([]);
    fetchSpy().mockResolvedValue(new Response("{}", { status: 200 }));
    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    const { sqlCalls } = await import("../helpers/sql");
    const last = sqlCalls[sqlCalls.length - 1];
    expect(last.values).toContain("sent");
    expect(last.values).toContain(null);
  });

  it("fails closed on alreadyRegistered SQL error (won't double-invite)", async () => {
    enqueueSql(new Error("db down"));
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("fails closed on alreadyInvited SQL error", async () => {
    enqueueSql([]); // registered
    enqueueSql(new Error("db down"));
    const f = fetchSpy();
    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
  });

  it("swallows recordInvite SQL error after a successful send", async () => {
    enqueueSql([]); // registered
    enqueueSql([]); // invited
    enqueueSql(new Error("insert boom"));
    fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "id" }), { status: 200 }),
    );
    await expect(
      enqueueViralInvites("acme.com", [
        { email: "x@partner.com", domain: "partner.com" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("HTML-escapes the sender domain in the rendered body", async () => {
    enqueueSql([]);
    enqueueSql([]);
    enqueueSql([]);
    const f = fetchSpy().mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), { status: 200 }),
    );
    await enqueueViralInvites("evil<script>.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    const call = f.mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string) as {
      html: string;
      text: string;
    };
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("evil&lt;script&gt;.com");
  });
});

describe("sendViaResend — malformed responses", () => {
  it("records 'failed' when reading the error body itself throws", async () => {
    enqueueSql([]); // alreadyRegistered
    enqueueSql([]); // alreadyInvited
    enqueueSql([]); // recordInvite

    // 4xx response whose .text() rejects — exercises the inner catch.
    const bogus = new Response("whatever", { status: 500 });
    Object.defineProperty(bogus, "text", {
      value: () => Promise.reject(new Error("stream closed")),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(bogus);

    await enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    const { sqlCalls } = await import("../helpers/sql");
    const last = sqlCalls[sqlCalls.length - 1];
    expect(last.values).toContain("failed");
  });
});

describe("cold-start — DATABASE_URL unset", () => {
  it("no-ops when RESEND is enabled but DATABASE_URL is unset (alreadyRegistered fails closed)", async () => {
    vi.resetModules();
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.STORAGE_URL;
    const mod = await import("@/lib/viral");
    const f = vi.spyOn(globalThis, "fetch");
    await mod.enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
    process.env.DATABASE_URL = prev;
  });
});

describe("enqueueViralInvites — disabled (no RESEND key)", () => {
  it("no-ops entirely when RESEND_API_KEY is unset", async () => {
    vi.resetModules();
    const prev = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const mod = await import("@/lib/viral");
    const f = fetchSpy();
    await mod.enqueueViralInvites("acme.com", [
      { email: "x@partner.com", domain: "partner.com" },
    ]);
    expect(f).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = prev;
  });
});
