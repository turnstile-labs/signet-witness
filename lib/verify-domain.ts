import { createHmac, timingSafeEqual } from "crypto";
import { promises as dns } from "dns";

// Owner-proof for Art 15 / 17 / 21 actions. The user publishes an
// HMAC-signed token as a DNS TXT record under `_witnessed.<domain>`;
// we resolve it and compare. The token is deterministic for a given
// (domain, action) within a UTC day, so the user can complete the
// flow at their own pace without server-side state, but a stolen
// challenge stops working at midnight UTC.

const SECRET =
  process.env.RIGHTS_SECRET ??
  process.env.INBOUND_SECRET ??
  "witnessed-dev-fallback-do-not-ship";

export type RightsAction = "erasure" | "opt_out" | "access";

export const RIGHTS_ACTIONS: readonly RightsAction[] = [
  "erasure",
  "opt_out",
  "access",
] as const;

export interface Challenge {
  challenge: string;
  host: string;
  value: string;
  expiresAt: string;
}

function todayUTC(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function generateChallenge(
  domain: string,
  action: RightsAction,
  day: string = todayUTC()
): Challenge {
  const normalized = normalizeDomain(domain);
  const mac = createHmac("sha256", SECRET)
    .update(`${normalized}|${action}|${day}`)
    .digest("hex")
    .slice(0, 32);

  const challenge = `witnessed-${action.replace("_", "-")}-${mac}`;
  const host = `_witnessed.${normalized}`;

  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 1);
  expires.setUTCHours(0, 0, 0, 0);

  return {
    challenge,
    host,
    value: challenge,
    expiresAt: expires.toISOString(),
  };
}

export interface VerifyResult {
  ok: boolean;
  error?: "no_txt_record" | "dns_error" | "challenge_mismatch";
}

// Tries today's challenge first, then yesterday's — handles the
// common case of a user creating the TXT late in a UTC day and
// verifying a minute after midnight.
export async function verifyTxtChallenge(
  domain: string,
  action: RightsAction
): Promise<VerifyResult> {
  const normalized = normalizeDomain(domain);
  const host = `_witnessed.${normalized}`;

  let records: string[][];
  try {
    records = await dns.resolveTxt(host);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "ENODATA" || code === "ENOTFOUND") {
      return { ok: false, error: "no_txt_record" };
    }
    return { ok: false, error: "dns_error" };
  }

  const flat = records.map((chunks) => chunks.join("").trim());

  const today = todayUTC();
  const yesterday = todayUTC(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const candidates = [
    generateChallenge(normalized, action, today).value,
    generateChallenge(normalized, action, yesterday).value,
  ];

  for (const expected of candidates) {
    if (flat.some((r) => safeEqualAscii(r, expected))) {
      return { ok: true };
    }
  }
  return { ok: false, error: "challenge_mismatch" };
}

function safeEqualAscii(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function normalizeDomain(input: string): string {
  return (input ?? "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

// Permissive but correct domain shape: at least one dot, only
// letters/digits/hyphens, no leading/trailing hyphen in any label.
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidDomain(input: string): boolean {
  const d = normalizeDomain(input);
  if (!d || d.length > 253) return false;
  const labels = d.split(".");
  if (labels.length < 2) return false;
  return labels.every((l) => DOMAIN_LABEL.test(l));
}
