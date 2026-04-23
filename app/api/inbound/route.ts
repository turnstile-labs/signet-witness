import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { authenticate } from "mailauth";
import { createHash } from "crypto";
import { upsertDomain, insertEvent, isDenylisted } from "@/lib/db";
import {
  receiverHasMx,
  isOnDbl,
  isRateLimited,
  recordThrottled,
  fetchFirstCertAt,
} from "@/lib/reputation";

const INBOUND_SECRET = process.env.INBOUND_SECRET ?? "";
const WITNESS_DOMAIN = "witnessed.cc";
const WITNESS_EMAIL = "seal@witnessed.cc";

export async function POST(req: NextRequest) {
  // 1. Authenticate the request — only accept from our Cloudflare Worker.
  const secret = req.headers.get("x-signet-secret");
  if (!secret || secret !== INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Read the raw RFC 2822 email body.
  let rawEmail: string;
  try {
    rawEmail = await req.text();
    if (!rawEmail) throw new Error("Empty body");
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // 3. Parse and verify DKIM signature via mailauth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  try {
    result = await authenticate(rawEmail, { sender: "", ip: "127.0.0.1" });
  } catch {
    return NextResponse.json({ error: "Parse error" }, { status: 400 });
  }

  // 4. Require at least one passing DKIM signature.
  const dkimResults: unknown[] = result?.dkim?.results ?? [];
  const passing = dkimResults.find(
    (r) => (r as { status?: { result?: string } }).status?.result === "pass"
  ) as { signature?: string } | undefined;

  if (!passing) {
    return NextResponse.json({ ok: true });
  }

  // 5. Extract sender domain from the raw From header line.
  const rawHeaders: string = rawEmail.split("\r\n\r\n")[0] ?? rawEmail.split("\n\n")[0] ?? "";
  const fromMatch = rawHeaders.match(/^From:.*?<([^>]+)>|^From:\s*(\S+)/im);
  const fromAddress = fromMatch?.[1] ?? fromMatch?.[2] ?? "";
  const senderDomain = extractDomain(fromAddress);
  if (!senderDomain || fromAddress.toLowerCase() === WITNESS_EMAIL) {
    return NextResponse.json({ ok: true });
  }

  // 6. Extract the primary receiver domain from the To / CC lines.
  // We only keep domains — individual recipient identities are never
  // stored publicly (GDPR), and nothing downstream of this file needs
  // full email addresses.
  const emailRegex = /@([\w.-]+\.[a-z]{2,})/gi;
  const toLine = rawHeaders.match(/^To:(.+?)(?=\r?\n\S|\r?\n\r?\n)/ims)?.[1] ?? "";
  const ccLine = rawHeaders.match(/^CC:(.+?)(?=\r?\n\S|\r?\n\r?\n)/ims)?.[1] ?? "";
  const receiverDomains: string[] = [];
  for (const m of (toLine + " " + ccLine).matchAll(emailRegex)) {
    const domain = m[1].toLowerCase();
    if (domain === WITNESS_DOMAIN) continue;
    if (domain === senderDomain) continue;
    if (!receiverDomains.includes(domain)) receiverDomains.push(domain);
  }
  const primaryReceiver = receiverDomains[0] ?? "unknown";

  // 7. GDPR — honor the denylist. If either the sender or the primary
  // receiver has opted out / exercised erasure, silently drop the event.
  // We 200 so the upstream SMTP path doesn't retry or bounce.
  try {
    const [senderBlocked, receiverBlocked] = await Promise.all([
      isDenylisted(senderDomain),
      primaryReceiver !== "unknown"
        ? isDenylisted(primaryReceiver)
        : Promise.resolve(false),
    ]);
    if (senderBlocked || receiverBlocked) {
      return NextResponse.json({ ok: true, dropped: "denylist" });
    }
  } catch (err) {
    // Best-effort check — log and continue.
    console.error("[inbound] denylist check failed", err);
  }

  // 8. Hash the DKIM signature for storage (proof without raw sig data).
  // Computed before the anti-abuse gates so throttled events carry the
  // same forensic hash as accepted ones.
  const dkimHash = createHash("sha256")
    .update(passing.signature ?? rawEmail.slice(0, 512))
    .digest("hex");

  // 9. Anti-abuse · receiver must have an MX record and must not be
  // on Spamhaus DBL. DKIM-valid mail addressed to a domain with no
  // mail exchange is a typo, a sinkhole, or a deliberately chosen
  // spoof target; mail addressed to a DBL-listed domain is almost
  // certainly part of an abuse loop. Both go to events_throttled
  // for ops review and never touch the sender's public record.
  //
  // Both lookups run in parallel — MX is a single DNS query (cached
  // 7d/1d) and DBL is a single DNS query to dbl.spamhaus.org (cached
  // 24h). Typical added latency on cache hit: ~0ms. On cache miss:
  // ~30-80ms.
  if (primaryReceiver !== "unknown") {
    const [hasMx, dblListed] = await Promise.all([
      receiverHasMx(primaryReceiver),
      isOnDbl(primaryReceiver),
    ]);
    if (!hasMx) {
      await recordThrottled(
        senderDomain,
        primaryReceiver,
        dkimHash,
        "receiver_no_mx",
      );
      return NextResponse.json({ ok: true, dropped: "receiver_no_mx" });
    }
    if (dblListed) {
      await recordThrottled(
        senderDomain,
        primaryReceiver,
        dkimHash,
        "receiver_blocklist",
      );
      return NextResponse.json({ ok: true, dropped: "receiver_blocklist" });
    }
  }

  // 10. Anti-abuse · Layer 0 — per-sender rate limit. A domain pushing
  // extraordinary volume (500/hour or 5000/day) trips the throttle;
  // subsequent events within the window are recorded for forensics
  // but not counted publicly. Enterprise-scale legitimate senders
  // brushing the ceiling become paid-tier conversations, not silent
  // drops.
  if (await isRateLimited(senderDomain)) {
    await recordThrottled(
      senderDomain,
      primaryReceiver,
      dkimHash,
      "rate_limit",
    );
    return NextResponse.json({ ok: true, dropped: "rate_limit" });
  }

  // 11. Write to DB.
  try {
    const domain = await upsertDomain(senderDomain);
    await insertEvent(domain.id, primaryReceiver, dkimHash);
  } catch (err) {
    console.error("DB write error", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // 12. Post-response work — CT-log warm-up for the sender domain
  // so the next score recompute picks up real tenure instead of the
  // system's `first_seen` fallback. Idempotent via its own 30-day
  // cache. Does not block the 200 going back upstream; the Vercel
  // runtime keeps the function alive long enough for `after()` to
  // drain.
  after(async () => {
    try {
      await fetchFirstCertAt(senderDomain);
    } catch (err) {
      console.error("[inbound] CT warm-up failed", { senderDomain, err });
    }
  });

  return NextResponse.json({ ok: true });
}

function extractDomain(address: string): string | null {
  if (!address) return null;
  const match = address.match(/@([\w.-]+\.[a-z]{2,})$/i);
  return match ? match[1].toLowerCase() : null;
}
