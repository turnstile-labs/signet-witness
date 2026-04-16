import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "mailauth";
import { createHash } from "crypto";
import { upsertDomain, insertEvent } from "@/lib/db";

const INBOUND_SECRET = process.env.INBOUND_SECRET ?? "";
const WITNESS_DOMAIN = "witnessed.cc";
const WITNESS_EMAIL = "signet@witnessed.cc";

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
  console.log("DKIM results:", JSON.stringify(dkimResults));
  console.log("From header:", result?.headers?.match?.(/^From:.+/im)?.[0]);
  const passing = dkimResults.find(
    (r) => (r as { status?: { result?: string } }).status?.result === "pass"
  ) as { signature?: string } | undefined;

  if (!passing) {
    console.log("DKIM failed — discarding");
    return NextResponse.json({ ok: true });
  }

  // 5. Extract sender domain from the raw From header line.
  // mailauth exposes headers as a raw string; parse with regex.
  const rawHeaders: string = result?.headers ?? rawEmail.split("\r\n\r\n")[0] ?? "";
  const fromMatch = rawHeaders.match(/^From:.*?<([^>]+)>|^From:\s*(\S+)/im);
  const fromAddress = fromMatch?.[1] ?? fromMatch?.[2] ?? "";
  const senderDomain = extractDomain(fromAddress);
  if (!senderDomain || fromAddress.toLowerCase() === WITNESS_EMAIL) {
    return NextResponse.json({ ok: true });
  }

  // 6. Extract receiver domains from To and CC header lines.
  const emailRegex = /[\w.+-]+@([\w.-]+\.[a-z]{2,})/gi;
  const toLine = rawHeaders.match(/^To:(.+?)(?=\r?\n\S|\r?\n\r?\n)/ims)?.[1] ?? "";
  const ccLine = rawHeaders.match(/^CC:(.+?)(?=\r?\n\S|\r?\n\r?\n)/ims)?.[1] ?? "";
  const allRecipients = (toLine + " " + ccLine).matchAll(emailRegex);
  const receiverDomains = Array.from(allRecipients)
    .map((m) => m[1].toLowerCase())
    .filter((d) => d !== WITNESS_DOMAIN && d !== senderDomain);

  const primaryReceiver = receiverDomains[0] ?? "unknown";

  // 7. Hash the DKIM signature for storage (proof without raw sig data).
  const dkimHash = createHash("sha256")
    .update(passing.signature ?? rawEmail.slice(0, 512))
    .digest("hex");

  // 8. Write to DB.
  console.log("DB write attempt — sender:", senderDomain, "receiver:", primaryReceiver);
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL, "STORAGE_URL set:", !!process.env.STORAGE_URL);
  try {
    const domain = await upsertDomain(senderDomain);
    await insertEvent(domain.id, primaryReceiver, dkimHash);
    console.log("DB write success — domain id:", domain.id);
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
