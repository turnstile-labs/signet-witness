// Viral invites — the "P.S. your domain just got a mutual counterparty"
// transactional email. Fired once per (sender_domain, receiver_email)
// pair, ever, and only when:
//
//   • receiver_domain is NOT free-mail (we don't pepper gmail users)
//   • receiver_domain is NOT already registered as a sender in our DB
//     (they already know about us)
//   • receiver_domain is NOT on our denylist (GDPR erasure / opt-out)
//   • (sender_domain, receiver_email) has not been invited before
//
// Gated behind RESEND_API_KEY — without the key the whole layer is a
// no-op, mirroring how DBL is gated behind SPAMHAUS_DQS_KEY.
//
// GDPR posture: the invite is strictly transactional. It informs the
// recipient that a specific sender has just produced verifiable proof
// of having emailed them, points at the public seal page of the sender
// (never reveals the recipient's identity back to the public surface),
// and offers a one-click opt-out.

import { neon } from "@neondatabase/serverless";
import { FREE_MAIL_DOMAINS } from "./scores";
import { isDenylisted } from "./db";

let _sql: ReturnType<typeof neon> | null = null;
function sql(...args: Parameters<ReturnType<typeof neon>>) {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.STORAGE_URL;
    if (!url) throw new Error("DATABASE_URL or STORAGE_URL is not set");
    _sql = neon(url);
  }
  return (_sql as ReturnType<typeof neon>)(...args);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || "";
const RESEND_ENABLED = RESEND_API_KEY.length > 0;
const FROM_ADDRESS = "Witnessed <hello@witnessed.cc>";
const MAX_INVITES_PER_EVENT = 3;

type Recipient = { email: string; domain: string };

async function alreadyRegistered(domain: string): Promise<boolean> {
  try {
    const rows = (await sql`
      SELECT 1 FROM domains WHERE domain = ${domain} LIMIT 1
    `) as unknown as unknown[];
    return rows.length > 0;
  } catch (err) {
    console.error("[viral] alreadyRegistered failed", { domain, err });
    // Fail-closed: if we can't verify the recipient isn't already a
    // customer, don't invite. Better silent miss than double-invite.
    return true;
  }
}

async function alreadyInvited(
  senderDomain: string,
  receiverEmail: string,
): Promise<boolean> {
  try {
    const rows = (await sql`
      SELECT 1 FROM viral_invites
      WHERE sender_domain = ${senderDomain}
        AND receiver_email = ${receiverEmail}
      LIMIT 1
    `) as unknown as unknown[];
    return rows.length > 0;
  } catch (err) {
    console.error("[viral] alreadyInvited failed", {
      senderDomain,
      receiverEmail,
      err,
    });
    // Fail-closed again — same reasoning.
    return true;
  }
}

async function recordInvite(
  senderDomain: string,
  receiverEmail: string,
  receiverDomain: string,
  status: "sent" | "failed" | "skipped",
  resendId: string | null,
): Promise<void> {
  try {
    await sql`
      INSERT INTO viral_invites
        (sender_domain, receiver_email, receiver_domain, status, resend_id)
      VALUES
        (${senderDomain}, ${receiverEmail}, ${receiverDomain}, ${status}, ${resendId})
      ON CONFLICT (sender_domain, receiver_email) DO UPDATE SET
        status    = EXCLUDED.status,
        resend_id = COALESCE(EXCLUDED.resend_id, viral_invites.resend_id)
    `;
  } catch (err) {
    console.error("[viral] recordInvite failed", {
      senderDomain,
      receiverEmail,
      err,
    });
  }
}

function renderBody(senderDomain: string, receiverEmail: string): {
  subject: string;
  text: string;
  html: string;
} {
  void receiverEmail;
  // Sender domain goes into a URL path segment. Real domains never
  // contain characters that need encoding, but this function is
  // general-purpose — percent-encode so a malformed domain cannot
  // smuggle structure into the href even in a pathological caller.
  const sealUrl = `https://witnessed.cc/b/${encodeURIComponent(senderDomain)}`;
  // /rights is the single GDPR control surface (opt-out / erasure /
  // subject access). We deliberately don't deep-link with the address
  // in the URL — the user is authenticated via DNS-TXT proof on that
  // flow, not a query-string token that could be scraped from logs.
  const optOutUrl = `https://witnessed.cc/rights`;
  const subject = `${senderDomain} just sealed an email to you on Witnessed`;

  const text = [
    `${senderDomain} just produced a cryptographically sealed record of`,
    `emailing you. It's on their public page:`,
    ``,
    `  ${sealUrl}`,
    ``,
    `Witnessed doesn't publish your identity — only the sender's`,
    `outbound record. Your address is never shown, sold, or listed.`,
    ``,
    `If you'd like your domain to build the same verifiable history,`,
    `CC sealed@witnessed.cc on any future outbound email.`,
    ``,
    `— Witnessed`,
    ``,
    `Don't want to hear about this again? ${optOutUrl}`,
  ].join("\n");

  const html = `
<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
  <p><strong>${escapeHtml(senderDomain)}</strong> just produced a cryptographically sealed record of emailing you.</p>
  <p>It lives on their public page:</p>
  <p><a href="${escapeHtml(sealUrl)}" style="color:#2563eb;text-decoration:none">${escapeHtml(sealUrl)}</a></p>
  <p style="color:#475569">Witnessed doesn't publish your identity — only the sender's outbound record. Your address is never shown, sold, or listed.</p>
  <p>If you'd like your domain to build the same verifiable history, CC <strong>sealed@witnessed.cc</strong> on any future outbound email.</p>
  <p style="color:#94a3b8;font-size:13px;margin-top:32px">
    — Witnessed
    <br/><br/>
    Don't want to hear about this again?
    <a href="${optOutUrl}" style="color:#94a3b8">Opt out</a>.
  </p>
</body>
</html>`.trim();

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendViaResend(
  toEmail: string,
  subject: string,
  text: string,
  html: string,
): Promise<{ ok: boolean; id: string | null; err?: unknown }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: toEmail,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, id: null, err: `Resend ${res.status}: ${body}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    return { ok: false, id: null, err };
  }
}

/**
 * For each recipient on a newly-accepted inbound event, consider
 * firing a one-time viral invite. All filtering and dedup happens
 * here — callers just pass the parsed recipients.
 *
 * Runs inside `after()`, so latency is off the critical path, but
 * we still cap to MAX_INVITES_PER_EVENT per event to keep the tail
 * bounded.
 */
export async function enqueueViralInvites(
  senderDomain: string,
  recipients: Recipient[],
): Promise<void> {
  if (!RESEND_ENABLED) return;
  if (!recipients.length) return;

  // Unique by (email, domain) and filter pre-flight. Order preserved
  // so "primary" recipients (first in To:) take priority.
  const seen = new Set<string>();
  const candidates: Recipient[] = [];
  for (const r of recipients) {
    if (!r.email || !r.domain) continue;
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    if (FREE_MAIL_DOMAINS.has(r.domain)) continue;
    candidates.push(r);
    if (candidates.length >= MAX_INVITES_PER_EVENT) break;
  }
  if (!candidates.length) return;

  for (const { email, domain } of candidates) {
    // GDPR: a domain on our denylist never receives an invite, even
    // if the sender just emailed them in the outside world.
    if (await isDenylisted(domain)) continue;

    // Skip if the recipient domain is already building its own
    // record — they don't need a viral nudge.
    if (await alreadyRegistered(domain)) continue;

    // Strict dedup on (sender, email). Same sender hitting the same
    // address a second time, a week later, does not trigger a second
    // invite.
    if (await alreadyInvited(senderDomain, email)) continue;

    const { subject, text, html } = renderBody(senderDomain, email);
    const { ok, id, err } = await sendViaResend(email, subject, text, html);

    if (ok) {
      await recordInvite(senderDomain, email, domain, "sent", id);
    } else {
      console.error("[viral] send failed", { senderDomain, email, err });
      await recordInvite(senderDomain, email, domain, "failed", null);
    }
  }
}
