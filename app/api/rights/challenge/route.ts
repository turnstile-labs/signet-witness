import { NextRequest, NextResponse } from "next/server";
import {
  generateChallenge,
  isValidDomain,
  normalizeDomain,
  RIGHTS_ACTIONS,
  type RightsAction,
} from "@/lib/verify-domain";

export const runtime = "nodejs";

// Mint a deterministic daily challenge for (domain, action).
// The user publishes it as a DNS TXT record under `_witnessed.<domain>`,
// then calls the action endpoint (erasure/opt-out/access).
export async function POST(req: NextRequest) {
  let body: { domain?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain ?? "");
  const action = body.action as RightsAction;

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "invalid_domain" }, { status: 400 });
  }
  if (!RIGHTS_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  return NextResponse.json(generateChallenge(domain, action));
}
