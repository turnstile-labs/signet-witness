// Vitest global setup — runs once before any test module loads.
//
// Pinning env vars here lets each production module evaluate its
// top-level `const FOO_ENABLED = process.env.FOO_KEY.length > 0`
// guard in the "enabled" position by default. Tests that want the
// disabled branch use `vi.resetModules()` + dynamic import after
// clearing the env var.

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1/test";
process.env.SPAMHAUS_DQS_KEY = "test-dqs";
process.env.INBOUND_SECRET = "test-inbound-secret";
process.env.STATS_TOKEN = "test-stats";

import { vi } from "vitest";
import { sqlTag } from "./helpers/sql";

// One neon client, one sql tag, shared across the run. The queue
// inside `sqlTag` is reset per-test by test files as needed.
vi.mock("@neondatabase/serverless", () => ({
  neon: () => sqlTag,
}));

// DNS mocks — individual tests override vi.mocked(dns.promises.*).
// We ship no-op defaults so an unexpected call doesn't hang on a
// real lookup.
vi.mock("dns", () => {
  const resolveMx = vi.fn(async () => {
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  });
  const resolve4 = vi.fn(async () => {
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  });
  return {
    promises: { resolveMx, resolve4 },
    default: { promises: { resolveMx, resolve4 } },
  };
});
