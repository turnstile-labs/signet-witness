import { NextRequest, NextResponse } from "next/server";
import {
  isValidDomain,
  normalizeDomain,
  verifyTxtChallenge,
} from "@/lib/verify-domain";
import { addToDenylist, eraseDomain } from "@/lib/db";

export const runtime = "nodejs";

// Art 17 — Right to erasure. Hard-deletes the domain's sender record
// (cascades its events) AND every event where it appears as a receiver,
// adjusting affected senders' event counts. Adds the domain to the
// denylist so future CCs are dropped silently.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const domain = normalizeDomain(body?.domain ?? "");

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  }

  const verification = await verifyTxtChallenge(domain, "erasure");
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error ?? "verification_failed" },
      { status: 403 }
    );
  }

  try {
    const result = await eraseDomain(domain);
    await addToDenylist(domain, "erasure");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[rights/erasure]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
