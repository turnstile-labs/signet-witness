import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupDomain } from "../src/lib/api";
import { readCache } from "../src/lib/cache";
import type { PublicPayload } from "../src/lib/types";

const ok = (over: Partial<PublicPayload> = {}): PublicPayload => ({
  domain: "acme.com",
  state: "verified",
  trustIndex: 80,
  verifiedEventCount: 12,
  mutualCounterparties: 4,
  uniqueReceivers: 6,
  inboundCount: null,
  firstSeen: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

function mockFetch(impl: (url: string) => Promise<Response> | Response): void {
  // happy-dom doesn't ship its own fetch by default in this version, so
  // we install a vitest mock onto globalThis.
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(
    impl,
  ) as unknown as typeof fetch;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupDomain", () => {
  it("hits the network on first call and caches the response", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse(ok())));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    const got = await lookupDomain("acme.com");
    expect(got.domain).toBe("acme.com");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const cached = await readCache("acme.com");
    expect(cached?.payload.state).toBe("verified");
  });

  it("serves subsequent calls from cache without re-fetching", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse(ok())));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    await lookupDomain("acme.com");
    await lookupDomain("acme.com");
    await lookupDomain("acme.com");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent in-flight requests for the same domain", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    const fetchSpy = vi.fn(() => pending);
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    const a = lookupDomain("acme.com");
    const b = lookupDomain("acme.com");
    const c = lookupDomain("acme.com");
    resolve(jsonResponse(ok()));
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(ra).toBe(rb);
    expect(rb).toBe(rc);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("writes an error marker when the network call fails", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    await expect(lookupDomain("flaky.com")).rejects.toThrow("offline");
    const cached = await readCache("flaky.com");
    expect(cached?.payload.state).toBe("error");
  });

  it("treats non-2xx as a failure and records an error marker", async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ msg: "nope" }, 503)));
    await expect(lookupDomain("downhost.com")).rejects.toThrow();
    const cached = await readCache("downhost.com");
    expect(cached?.payload.state).toBe("error");
  });

  it("rejects payloads with an unknown state and caches an error marker", async () => {
    // Defends against a deploy that introduces a new server-side state
    // before the extension is updated. The popup must not render unknown
    // pills, and the negative cache stops repeated lookups for it.
    mockFetch(() =>
      Promise.resolve(
        jsonResponse({ ...ok(), state: "futureUnknownState" }),
      ),
    );
    await expect(lookupDomain("future.com")).rejects.toThrow("invalid payload");
    const cached = await readCache("future.com");
    expect(cached?.payload.state).toBe("error");
  });

  it("returns the cached error marker without re-fetching after a failure", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("boom")));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;

    await expect(lookupDomain("bad.com")).rejects.toThrow();
    const second = await lookupDomain("bad.com");
    // Only the first fetch ever ran; the second resolved from the marker.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.state).toBe("error");
  });

  it("uses HTTPS witnessed.cc origin for lookups", async () => {
    const fetchSpy = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(ok({ domain: url }))),
    );
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
    await lookupDomain("acme.com");
    const calledWith = fetchSpy.mock.calls[0][0] as string;
    expect(calledWith).toMatch(
      /^https:\/\/witnessed\.cc\/api\/public\/domain\//,
    );
  });

  it("URL-encodes domains so weird inputs can't break the path", async () => {
    const fetchSpy = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(ok({ domain: "weird/host.com" }))),
    );
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
    await lookupDomain("weird/host.com");
    const calledWith = fetchSpy.mock.calls[0][0] as string;
    expect(calledWith).toContain("weird%2Fhost.com");
  });
});
