import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "mailauth";
import { createHash } from "crypto";
import { upsertDomain, insertEvent } from "@/lib/db";

const INBOUND_SECRET = process.env.INBOUND_SECRET ?? "";
const WITNESS_DOMAIN = "signet.id";

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
  let result: Awaited<ReturnType<typeof authenticate>>;
  try {
    result = await authenticate(rawEmail, { sender: "", ip: "127.0.0.1" });
  } catch {
    return NextResponse.json({ error: "Parse error" }, { status: 400 });
  }

  // 4. Require at least one passing DKIM signature.
  const dkimResults = result.dkim?.results ?? [];
  const passing = dkimResults.find((r: { status: { result: string } }) => r.status?.result === "pass");
  if (!passing) {
    // Silently discard — don't reveal failure reason externally.
    return NextResponse.json({ ok: true });
  }

  // 5. Extract sender domain from the From header.
  const fromHeader: string = result.headers?.parsed?.from?.[0]?.value?.[0]?.address ?? "";
  const senderDomain = extractDomain(fromHeader);
  if (!senderDomain || senderDomain === WITNESS_DOMAIN) {
    return NextResponse.json({ ok: true });
  }

  // 6. Extract receiver domains — To + CC headers, excluding witness@signet.id itself.
  const toAddresses: string[] = (result.headers?.parsed?.to ?? [])
    .flatMap((h: { value: { address: string }[] }) => h.value.map((v: { address: string }) => v.address));
  const ccAddresses: string[] = (result.headers?.parsed?.cc ?? [])
    .flatMap((h: { value: { address: string }[] }) => h.value.map((v: { address: string }) => v.address));

  const receiverDomains = [...toAddresses, ...ccAddresses]
    .map(extractDomain)
    .filter((d): d is string => !!d && d !== WITNESS_DOMAIN && d !== senderDomain);

  // Use first non-witness receiver, or fall back to a generic placeholder.
  const primaryReceiver = receiverDomains[0] ?? "unknown";

  // 7. Hash the DKIM signature for storage (we store proof, not the raw sig).
  const dkimHash = createHash("sha256")
    .update(passing.signature ?? rawEmail.slice(0, 512))
    .digest("hex");

  // 8. Write to DB.
  try {
    const domain = await upsertDomain(senderDomain);
    await insertEvent(domain.id, primaryReceiver, dkimHash);
  } catch (err) {
    console.error("DB write error", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function extractDomain(address: string): string | null {
  if (!address) return null;
  const match = address.match(/@([\w.-]+\.[a-z]{2,})$/i);
  return match ? match[1].toLowerCase() : null;
}
