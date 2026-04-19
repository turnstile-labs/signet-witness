import { NextRequest, NextResponse } from "next/server";
import {
  isValidDomain,
  normalizeDomain,
  verifyTxtChallenge,
} from "@/lib/verify-domain";
import { exportDomainData } from "@/lib/db";

export const runtime = "nodejs";

// Art 15 — Right of access. Returns a full machine-readable dump of
// everything held about the domain, including records where it appears
// only as a receiver.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const domain = normalizeDomain(body?.domain ?? "");

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  }

  const verification = await verifyTxtChallenge(domain, "access");
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error ?? "verification_failed" },
      { status: 403 }
    );
  }

  try {
    const data = await exportDomainData(domain);
    return NextResponse.json(
      {
        ok: true,
        queriedDomain: domain,
        ...data,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="witnessed-${domain}-${new Date()
            .toISOString()
            .slice(0, 10)}.json"`,
        },
      }
    );
  } catch (err) {
    console.error("[rights/access]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
