import { NextRequest, NextResponse } from "next/server";
import {
  isValidDomain,
  normalizeDomain,
  verifyTxtChallenge,
} from "@/lib/verify-domain";
import { addToDenylist } from "@/lib/db";

export const runtime = "nodejs";

// Art 21 — Right to object. Adds the domain to the denylist so future
// inbound emails involving it are dropped, but leaves existing records
// intact. Use erasure for a full purge.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const domain = normalizeDomain(body?.domain ?? "");

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  }

  const verification = await verifyTxtChallenge(domain, "opt_out");
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error ?? "verification_failed" },
      { status: 403 }
    );
  }

  try {
    await addToDenylist(domain, "opt_out");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[rights/opt-out]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
