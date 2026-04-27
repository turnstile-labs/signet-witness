interface Env {
  INBOUND_URL: string;    // e.g. https://witnessed.cc/api/inbound
  INBOUND_SECRET: string; // must match INBOUND_SECRET in the Next.js app
}

// Maximum attempts to deliver one email to /api/inbound. Each attempt
// is `forward()` to a Vercel Function with its own ~10s budget; we
// stay well below the Workers free-tier 30s wall-clock cap.
//
// Rationale for 3:
//   * 1 = no retry, current pre-fix behaviour, drops mail on any blip
//   * 2 = covers a single transient (Vercel cold start, DB pool flap)
//   * 3 = covers the rarer "two transients in a row" without dragging
//         out a real outage. Past 3 attempts, more retries don't fix
//         the root cause — they just delay the inevitable log entry.
const MAX_ATTEMPTS = 3;

// Backoff schedule between attempts, in milliseconds. Indices align
// with attempt numbers: BACKOFF_MS[1] is the wait BEFORE attempt 2,
// BACKOFF_MS[2] is the wait BEFORE attempt 3. Keep total well under
// 30s so the Worker never times out — current sum is 7s.
const BACKOFF_MS = [0, 2_000, 5_000];

// HTTP status codes we treat as deterministic failures — retrying
// produces the same answer, so we cut our losses and log instead.
//
//   400 — malformed body or DKIM parse error in /api/inbound. The
//         email is structurally invalid; the next attempt sees the
//         same input and gets the same response.
//   401 — auth header mismatch. Misconfigured INBOUND_SECRET on one
//         side. Retrying spams the inbound endpoint with bad creds
//         and surfaces the misconfig more loudly than logging once.
//
// Anything else in 4xx is also treated as deterministic for the same
// reason; only 5xx and network-level errors get retried.
const NON_RETRYABLE = new Set([400, 401, 403, 404, 422]);

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const raw = await streamToText(message.raw);

    // Correlation ID stitches the Worker log line and the Vercel
    // function log together. Eight bytes of randomness is plenty for
    // grep-level matching at our volume; not security-sensitive.
    const correlationId = crypto.randomUUID().slice(0, 8);

    let lastStatus: number | string = "no_attempt";
    let lastBody = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt - 1] > 0) {
        await sleep(BACKOFF_MS[attempt - 1]);
      }

      try {
        const res = await fetch(env.INBOUND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "message/rfc822",
            // Shared-secret header for the inbound webhook. Must match the
            // `INBOUND_SECRET` env var on the Next.js side; the app rejects
            // any request that doesn't carry this exact header.
            "X-Witnessed-Secret": env.INBOUND_SECRET,
            // Correlation header so Vercel access logs can be joined to
            // this Worker's `wrangler tail` output by a single short ID.
            "X-Witnessed-Correlation-Id": correlationId,
            // Tells the inbound side which attempt this is. Useful both
            // for forensics ("did the third attempt also 500?") and to
            // let the inbound side eventually short-circuit duplicate
            // work if it ever becomes deduplication-aware.
            "X-Witnessed-Attempt": String(attempt),
          },
          body: raw,
        });

        if (res.ok) return; // 2xx, including intentional `{ dropped: ... }`

        lastStatus = res.status;
        lastBody = await res.text().catch(() => "");

        // 4xx — deterministic. Stop and log; retrying produces the
        // same answer.
        if (NON_RETRYABLE.has(res.status)) {
          console.error(
            `inbound non-retryable ${res.status} [${correlationId}]:`,
            lastBody.slice(0, 500),
          );
          return;
        }

        // 5xx (or any other non-OK) → fall through to retry.
        console.warn(
          `inbound transient ${res.status} attempt ${attempt}/${MAX_ATTEMPTS} [${correlationId}]:`,
          lastBody.slice(0, 200),
        );
      } catch (err) {
        // Network-layer error (DNS, TLS, socket reset). Treat as
        // transient and retry; same shape as a 5xx for our purposes.
        lastStatus = (err as Error)?.message ?? "fetch_error";
        console.warn(
          `inbound fetch error attempt ${attempt}/${MAX_ATTEMPTS} [${correlationId}]:`,
          lastStatus,
        );
      }
    }

    // All attempts exhausted. We deliberately do NOT call
    // `message.setReject()` here. setReject generates a bounce email
    // back to the original sender, which would (a) leak our integration
    // to a counterparty who doesn't know we're in the loop and (b)
    // spam legitimate senders during any Vercel outage. The tradeoff
    // is that an outage longer than the retry budget means the email
    // is lost; documented in workers/email-router/README and tracked
    // by the loud log line below.
    console.error(
      `inbound failed after ${MAX_ATTEMPTS} attempts [${correlationId}]: last=${lastStatus}`,
    );
  },
};

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
