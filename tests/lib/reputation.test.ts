import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { promises as dns } from "dns";
import {
  receiverHasMx,
  isOnDbl,
  isRateLimited,
  recordThrottled,
  cachedFirstCertAt,
  fetchFirstCertAt,
} from "@/lib/reputation";
import { enqueueSql, resetSql, sqlCalls } from "../helpers/sql";

const resolveMxMock = vi.mocked(dns.resolveMx);
const resolve4Mock = vi.mocked(dns.resolve4);

beforeEach(() => {
  resetSql();
  resolveMxMock.mockReset();
  resolve4Mock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("receiverHasMx", () => {
  it("accepts a trivially-true 'unknown' receiver", async () => {
    expect(await receiverHasMx("unknown")).toBe(true);
    expect(await receiverHasMx("")).toBe(true);
  });

  it("returns cached positive result without a DNS call when within TTL", async () => {
    enqueueSql([
      { mx_exists: true, mx_checked_at: new Date().toISOString() },
    ]);
    expect(await receiverHasMx("fresh.example")).toBe(true);
    expect(resolveMxMock).not.toHaveBeenCalled();
  });

  it("returns cached negative result without a DNS call when within TTL", async () => {
    enqueueSql([
      { mx_exists: false, mx_checked_at: new Date().toISOString() },
    ]);
    expect(await receiverHasMx("nomail.example")).toBe(false);
  });

  it("refreshes the cache when the positive entry is past TTL", async () => {
    // 10-day-old positive row — past the 7d positive TTL.
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    enqueueSql([{ mx_exists: true, mx_checked_at: old }]); // read
    enqueueSql([]); // write
    resolveMxMock.mockResolvedValue([
      { exchange: "mx1.example", priority: 10 },
    ]);
    expect(await receiverHasMx("stale.example")).toBe(true);
    expect(resolveMxMock).toHaveBeenCalledOnce();
  });

  it("refreshes negative cache past the shorter negative TTL", async () => {
    // 3-day-old negative row — past the 1d negative TTL.
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    enqueueSql([{ mx_exists: false, mx_checked_at: old }]);
    enqueueSql([]);
    resolveMxMock.mockResolvedValue([
      { exchange: "mx1.example", priority: 10 },
    ]);
    expect(await receiverHasMx("recovered.example")).toBe(true);
  });

  it("does a live lookup on cache miss and caches a positive answer", async () => {
    enqueueSql([]); // read cache → miss
    enqueueSql([]); // write cache
    resolveMxMock.mockResolvedValue([
      { exchange: "mx1.example", priority: 10 },
    ]);
    expect(await receiverHasMx("new.example")).toBe(true);
  });

  it("treats ENOTFOUND / ENODATA / NXDOMAIN as authoritative negatives", async () => {
    for (const code of ["ENOTFOUND", "ENODATA", "NXDOMAIN"]) {
      resetSql();
      enqueueSql([]);
      enqueueSql([]);
      resolveMxMock.mockRejectedValue(Object.assign(new Error(code), { code }));
      expect(await receiverHasMx(`${code}.example`)).toBe(false);
    }
  });

  it("fails open when DNS errors are not authoritative negatives", async () => {
    enqueueSql([]);
    enqueueSql([]);
    resolveMxMock.mockRejectedValue(
      Object.assign(new Error("SERVFAIL"), { code: "SERVFAIL" }),
    );
    expect(await receiverHasMx("flaky.example")).toBe(true);
  });

  it("fails open when cache reads raise", async () => {
    enqueueSql(new Error("db down"));
    enqueueSql([]); // live write
    resolveMxMock.mockResolvedValue([
      { exchange: "mx1.example", priority: 10 },
    ]);
    expect(await receiverHasMx("read-err.example")).toBe(true);
  });

  it("returns a live positive answer even if the cache write fails", async () => {
    enqueueSql([]);
    enqueueSql(new Error("cache write boom"));
    resolveMxMock.mockResolvedValue([
      { exchange: "mx1.example", priority: 10 },
    ]);
    expect(await receiverHasMx("write-err.example")).toBe(true);
  });

  it("returns empty-MX-list as 'no MX' and caches the negative", async () => {
    enqueueSql([]);
    enqueueSql([]);
    resolveMxMock.mockResolvedValue([]);
    expect(await receiverHasMx("noresults.example")).toBe(false);
  });
});

describe("isOnDbl — refusal-code handling (the gmail.com bug)", () => {
  it("treats 127.255.255.x as a public-resolver refusal, not a listing, and fails open", async () => {
    enqueueSql([]); // read cache → miss
    // NO write: refusals must NOT be cached.
    resolve4Mock.mockResolvedValue(["127.255.255.252"]);
    expect(await isOnDbl("gmail.com")).toBe(false);
  });

  it("treats 127.0.1.255 (rate-limited) as a refusal and fails open", async () => {
    enqueueSql([]);
    resolve4Mock.mockResolvedValue(["127.0.1.255"]);
    expect(await isOnDbl("rl.example")).toBe(false);
  });

  it("flags a real listing (127.0.1.2)", async () => {
    enqueueSql([]); // read
    enqueueSql([]); // write
    resolve4Mock.mockResolvedValue(["127.0.1.2"]);
    expect(await isOnDbl("spam.example")).toBe(true);
  });

  it("ignores a single refusal in a mixed response and still flags the listing", async () => {
    enqueueSql([]);
    enqueueSql([]);
    resolve4Mock.mockResolvedValue(["127.255.255.252", "127.0.1.2"]);
    expect(await isOnDbl("mixed.example")).toBe(true);
  });

  it("treats NXDOMAIN as not-listed", async () => {
    enqueueSql([]); // read
    enqueueSql([]); // write
    resolve4Mock.mockRejectedValue(
      Object.assign(new Error("NXDOMAIN"), { code: "NXDOMAIN" }),
    );
    expect(await isOnDbl("clean.example")).toBe(false);
  });

  it("fails open on unclassified DNS errors", async () => {
    enqueueSql([]);
    resolve4Mock.mockRejectedValue(
      Object.assign(new Error("SERVFAIL"), { code: "SERVFAIL" }),
    );
    expect(await isOnDbl("flaky.example")).toBe(false);
  });

  it("respects a cached positive listing without a live DNS call", async () => {
    enqueueSql([
      { dbl_listed: true, dbl_checked_at: new Date().toISOString() },
    ]);
    expect(await isOnDbl("known-bad.example")).toBe(true);
    expect(resolve4Mock).not.toHaveBeenCalled();
  });

  it("refreshes past-TTL cache entries", async () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    enqueueSql([{ dbl_listed: false, dbl_checked_at: old }]);
    enqueueSql([]); // write
    resolve4Mock.mockRejectedValue(
      Object.assign(new Error("NXDOMAIN"), { code: "NXDOMAIN" }),
    );
    expect(await isOnDbl("refresh.example")).toBe(false);
  });

  it("ignores empty domain inputs", async () => {
    expect(await isOnDbl("")).toBe(false);
    expect(await isOnDbl("unknown")).toBe(false);
  });
});

describe("isOnDbl — disabled (no DQS key)", () => {
  it("short-circuits without a DB or DNS call", async () => {
    vi.resetModules();
    const prev = process.env.SPAMHAUS_DQS_KEY;
    delete process.env.SPAMHAUS_DQS_KEY;
    const mod = await import("@/lib/reputation");
    expect(await mod.isOnDbl("gmail.com")).toBe(false);
    expect(resolve4Mock).not.toHaveBeenCalled();
    process.env.SPAMHAUS_DQS_KEY = prev;
  });
});

describe("cache-layer error paths", () => {
  it("isOnDbl fails open when the DBL cache read errors", async () => {
    enqueueSql(new Error("db down")); // read fails
    enqueueSql([]); // write ok
    resolve4Mock.mockRejectedValue(
      Object.assign(new Error("NXDOMAIN"), { code: "NXDOMAIN" }),
    );
    expect(await isOnDbl("readerr.example")).toBe(false);
  });

  it("isOnDbl tolerates a DBL cache-write failure on a real listing", async () => {
    enqueueSql([]); // read miss
    enqueueSql(new Error("write boom")); // write fails
    resolve4Mock.mockResolvedValue(["127.0.1.2"]);
    expect(await isOnDbl("writerr.example")).toBe(true);
  });

  it("fetchFirstCertAt tolerates a cache-write failure", async () => {
    enqueueSql([]); // read miss
    enqueueSql(new Error("write boom")); // write fails
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ not_before: "2020-03-01T00:00:00Z" }]),
        { status: 200 },
      ),
    );
    const r = await fetchFirstCertAt("writerr.example");
    expect(r?.toISOString()).toBe("2020-03-01T00:00:00.000Z");
  });
});

describe("withTimeout — DNS hang", () => {
  it("rejects with 'dns timeout' after the configured window", async () => {
    vi.useFakeTimers();
    try {
      enqueueSql([]); // read miss
      enqueueSql([]); // write fail-open
      // Return a promise that never resolves — forces the timeout.
      resolveMxMock.mockImplementation(() => new Promise(() => {}));
      const p = receiverHasMx("timeout.example");
      await vi.advanceTimersByTimeAsync(4000);
      // receiverHasMx fails open on unclassified errors.
      expect(await p).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("cold-start — DATABASE_URL unset", () => {
  it("recordThrottled swallows the throw-from-sql-wrapper", async () => {
    vi.resetModules();
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.STORAGE_URL;
    const mod = await import("@/lib/reputation");
    await expect(
      mod.recordThrottled("acme.com", "x.com", "h", "rate_limit"),
    ).resolves.toBeUndefined();
    process.env.DATABASE_URL = prev;
  });
});

describe("isRateLimited", () => {
  it("is false when sender domain is empty", async () => {
    expect(await isRateLimited("")).toBe(false);
  });

  it("is false under both ceilings", async () => {
    enqueueSql([{ hourly: 10, daily: 100 }]);
    expect(await isRateLimited("acme.com")).toBe(false);
  });

  it("is true at or over the hourly ceiling", async () => {
    enqueueSql([{ hourly: 500, daily: 500 }]);
    expect(await isRateLimited("acme.com")).toBe(true);
  });

  it("is true at or over the daily ceiling even if hourly is low", async () => {
    enqueueSql([{ hourly: 1, daily: 5000 }]);
    expect(await isRateLimited("acme.com")).toBe(true);
  });

  it("fails open on DB error", async () => {
    enqueueSql(new Error("db down"));
    expect(await isRateLimited("acme.com")).toBe(false);
  });

  it("treats an empty row set as under the ceiling", async () => {
    enqueueSql([]);
    expect(await isRateLimited("acme.com")).toBe(false);
  });
});

describe("recordThrottled", () => {
  it("inserts a throttled event with the supplied reason", async () => {
    enqueueSql([]);
    await recordThrottled("acme.com", "victim.com", "h", "rate_limit");
    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0].values).toContain("rate_limit");
  });

  it("swallows write errors", async () => {
    enqueueSql(new Error("db down"));
    await expect(
      recordThrottled("acme.com", "victim.com", "h", "receiver_no_mx"),
    ).resolves.toBeUndefined();
  });
});

describe("cachedFirstCertAt", () => {
  it("returns null for unknown / empty domains", async () => {
    expect(await cachedFirstCertAt("")).toBeNull();
    expect(await cachedFirstCertAt("unknown")).toBeNull();
  });

  it("returns null on cache miss", async () => {
    enqueueSql([]);
    expect(await cachedFirstCertAt("new.example")).toBeNull();
  });

  it("returns the stored date when present", async () => {
    const iso = "2020-01-15T00:00:00.000Z";
    enqueueSql([{ first_cert_at: iso, cert_checked_at: new Date().toISOString() }]);
    const r = await cachedFirstCertAt("old.example");
    expect(r?.toISOString()).toBe(iso);
  });

  it("returns null when the stored entry recorded a miss", async () => {
    enqueueSql([
      { first_cert_at: null, cert_checked_at: new Date().toISOString() },
    ]);
    expect(await cachedFirstCertAt("nocert.example")).toBeNull();
  });

  it("returns null if the cache read throws", async () => {
    enqueueSql(new Error("db down"));
    expect(await cachedFirstCertAt("boom.example")).toBeNull();
  });
});

describe("fetchFirstCertAt", () => {
  it("returns null for unknown / empty domains", async () => {
    expect(await fetchFirstCertAt("")).toBeNull();
    expect(await fetchFirstCertAt("unknown")).toBeNull();
  });

  it("short-circuits to the cached positive hit without a network call", async () => {
    const iso = "2021-06-01T00:00:00.000Z";
    enqueueSql([{ first_cert_at: iso, cert_checked_at: new Date().toISOString() }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await fetchFirstCertAt("cached.example");
    expect(r?.toISOString()).toBe(iso);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for a recent cached miss without re-hitting the network", async () => {
    enqueueSql([
      { first_cert_at: null, cert_checked_at: new Date().toISOString() },
    ]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await fetchFirstCertAt("recent-miss.example")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-queries when the cached miss is older than 30 days", async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    enqueueSql([{ first_cert_at: null, cert_checked_at: old }]);
    enqueueSql([]); // cache write

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ not_before: "2019-05-01T00:00:00Z" }]),
        { status: 200 },
      ),
    );
    const r = await fetchFirstCertAt("aged-miss.example");
    expect(r).not.toBeNull();
  });

  it("picks the earliest date from crt.sh rows", async () => {
    enqueueSql([]); // read miss
    enqueueSql([]); // write
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { not_before: "2022-05-01T00:00:00Z" },
          { not_before: "2019-01-15T00:00:00Z" },
          { not_before: "2021-07-10T00:00:00Z" },
        ]),
        { status: 200 },
      ),
    );
    const r = await fetchFirstCertAt("multi.example");
    expect(r?.toISOString()).toBe("2019-01-15T00:00:00.000Z");
  });

  it("skips malformed rows without crashing", async () => {
    enqueueSql([]);
    enqueueSql([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { not_before: "garbage" },
          {},
          { not_before: "2020-03-01T00:00:00Z" },
        ]),
        { status: 200 },
      ),
    );
    const r = await fetchFirstCertAt("skip.example");
    expect(r?.toISOString()).toBe("2020-03-01T00:00:00.000Z");
  });

  it("returns null and caches the miss on empty crt.sh response", async () => {
    enqueueSql([]);
    enqueueSql([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    expect(await fetchFirstCertAt("empty.example")).toBeNull();
  });

  it("returns null on non-2xx response", async () => {
    enqueueSql([]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("server error", { status: 503 }),
    );
    expect(await fetchFirstCertAt("down.example")).toBeNull();
  });

  it("returns null on network error", async () => {
    enqueueSql([]);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect(await fetchFirstCertAt("net-err.example")).toBeNull();
  });
});
