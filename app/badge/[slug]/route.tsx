import { getDomain } from "@/lib/db";
import { ImageResponse } from "next/og";

// Verified thresholds — mirrors the seal page.
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// Badge canvas — compact single-line pill sized for email signatures.
// Kept deliberately small: we want this to sit alongside a name + role
// line without dominating the signature. No brand-attribution strip —
// the hyperlink target carries the brand.
const W = 260;
const H = 26;

// Accept slugs like "acme.com", "acme.com.svg" or "acme.com.png".
function parseSlug(slug: string): { domain: string; format: "svg" | "png" } {
  const decoded = decodeURIComponent(slug).toLowerCase().trim();
  if (decoded.endsWith(".png")) {
    return { domain: decoded.slice(0, -4), format: "png" };
  }
  if (decoded.endsWith(".svg")) {
    return { domain: decoded.slice(0, -4), format: "svg" };
  }
  return { domain: decoded, format: "svg" };
}

// XML-escape the domain before injecting into the SVG source.
function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default:  return c;
    }
  });
}

type Theme = "dark" | "light";
type State = "verified" | "onRecord" | "pending";

interface Palette {
  bg: string;
  border: string;
  domain: string;   // primary — the domain wordmark
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: "#0c0c0f",
    border: "#25252f",
    domain: "#e8e8f2",
  },
  light: {
    bg: "#ffffff",
    border: "#e0e0ec",
    domain: "#18181e",
  },
};

interface StatusStyle {
  dot: string;
  text: string;
  fill: string;
  stroke: string;
  label: string;
}

function stateStyle(state: State): StatusStyle {
  switch (state) {
    case "verified":
      return {
        dot: "#22c55e",
        text: "#16a34a",
        fill: "#16a34a1a",
        stroke: "#16a34a4d",
        label: "VERIFIED",
      };
    case "onRecord":
      // Same green family as verified, softened — "live, ongoing" without
      // the amber warning read the old building palette carried.
      return {
        dot: "#16a34a",
        text: "#16a34acc",
        fill: "#16a34a0d",
        stroke: "#16a34a33",
        label: "ON RECORD",
      };
    case "pending":
      return {
        dot: "#9090b0",
        text: "#60607a",
        fill: "#9090b01a",
        stroke: "#9090b04d",
        label: "PENDING",
      };
  }
}

function truncateDomain(domain: string, maxChars: number): string {
  return domain.length > maxChars
    ? domain.slice(0, Math.max(1, maxChars - 1)) + "…"
    : domain;
}

// Status label shown inside the pill — append the live event count for
// recorded/verified states so the badge reflects the current record.
function statusLabel(state: State, count: number, s: StatusStyle): string {
  return state === "pending" ? s.label : `${s.label} · ${count}`;
}

function renderSvg(
  domain: string,
  state: State,
  count: number,
  theme: Theme
): string {
  const p = PALETTES[theme];
  const s = stateStyle(state);
  const label = statusLabel(state, count, s);

  // Status pill — sized to fit the label (state + count).
  const pillCharW = 5.2;
  const pillW = Math.max(64, Math.round(label.length * pillCharW + 22));
  const pillH = 16;
  const pillX = W - 8 - pillW;
  const pillY = (H - pillH) / 2;

  // Domain on the left — monospaced, centered vertically.
  const domainStartX = 10;
  const availableDomainW = pillX - 8 - domainStartX;
  const domainCharW = 6.6; // monospace @ 11px
  const maxDomainChars = Math.max(4, Math.floor(availableDomainW / domainCharW));
  const displayDomain = truncateDomain(domain, maxDomainChars);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${label.toLowerCase()})">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="${p.bg}" stroke="${p.border}"/>
  <text x="${domainStartX}" y="${H / 2 + 4}" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="11" font-weight="600" fill="${p.domain}">${esc(displayDomain)}</text>
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${s.fill}" stroke="${s.stroke}"/>
  <circle cx="${pillX + 9}" cy="${pillY + pillH / 2}" r="2.5" fill="${s.dot}"/>
  <text x="${pillX + 16}" y="${pillY + pillH / 2 + 3}" font-family="Helvetica, Arial, sans-serif" font-size="8" font-weight="700" letter-spacing="0.08em" fill="${s.text}">${esc(label)}</text>
</svg>`;
}

// PNG variant — renders the same badge via next/og so it embeds
// cleanly in email signatures (Gmail, Outlook, Apple Mail).
function renderPng(
  domain: string,
  state: State,
  count: number,
  theme: Theme,
  cacheHeaders: Record<string, string>
) {
  const p = PALETTES[theme];
  const s = stateStyle(state);
  const label = statusLabel(state, count, s);
  // PNG rendering (flexbox) auto-scales to content, so we only truncate
  // for very long domains to keep the overall canvas proportional.
  const displayDomain = truncateDomain(domain, 24);

  // Rendered at 2× for retina crispness; the HTML snippet still
  // displays the image at W×H logical pixels.
  const PNG_W = W * 2;
  const PNG_H = H * 2;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: p.bg,
          borderRadius: 12,
          border: `2px solid ${p.border}`,
          alignItems: "center",
          padding: "0 14px",
          fontFamily: "sans-serif",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            color: p.domain,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "monospace",
            lineHeight: 1,
          }}
        >
          {displayDomain}
        </span>

        <div style={{ display: "flex", flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "5px 13px",
            borderRadius: 999,
            background: s.fill,
            border: `2px solid ${s.stroke}`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: s.dot,
              marginRight: 8,
            }}
          />
          <span
            style={{
              color: s.text,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.4,
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        </div>
      </div>
    ),
    {
      width: PNG_W,
      height: PNG_H,
      headers: cacheHeaders,
    }
  );
}

interface Snapshot {
  state: State;
  count: number;
}

async function resolveSnapshot(domain: string): Promise<Snapshot> {
  try {
    const record = await getDomain(domain);
    if (!record) return { state: "pending", count: 0 };
    const days = Math.floor(
      (Date.now() - new Date(record.first_seen).getTime()) / 86_400_000
    );
    const state: State =
      days >= VERIFIED_DAYS && record.event_count >= VERIFIED_EMAILS
        ? "verified"
        : "onRecord";
    return { state, count: record.event_count };
  } catch {
    return { state: "pending", count: 0 };
  }
}

// Aggressive-but-friendly caching for email embeds.
//
//   max-age=60           — browsers / Apple Mail refresh at most every minute
//   s-maxage=120         — Vercel edge caches 2 min, keeping origin hits low
//   stale-while-revalidate=3600
//                        — edge serves last version while re-fetching in the
//                          background, so users never wait on a cold cache
//
// Gmail's image proxy has its own cache heuristics that we can't fully
// control, but a short max-age plus an ETag keyed on (state, count, theme)
// means it *can* revalidate cheaply and pick up new counts within hours.
function cacheHeaders(
  snapshot: Snapshot,
  theme: Theme,
  format: "svg" | "png"
): Record<string, string> {
  const etag = `W/"${snapshot.state}-${snapshot.count}-${theme}-${format}"`;
  return {
    "Cache-Control":
      "public, max-age=60, s-maxage=120, stale-while-revalidate=3600",
    ETag: etag,
    "Access-Control-Allow-Origin": "*",
    ...(format === "svg"
      ? { "Content-Type": "image/svg+xml; charset=utf-8" }
      : {}),
  };
}

// Tell Next not to ISR-cache this response — we manage freshness via the
// HTTP headers above, and the payload is tiny.
export const revalidate = 0;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const { domain, format } = parseSlug(slug);

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return new Response("invalid domain", { status: 400 });
  }

  const theme: Theme =
    new URL(request.url).searchParams.get("theme") === "light"
      ? "light"
      : "dark";

  const snapshot = await resolveSnapshot(domain);
  const headers = cacheHeaders(snapshot, theme, format);

  // Conditional GET — respond 304 when the caller (CDN, Gmail proxy, browser)
  // already has the same (state, count, theme) fingerprint.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  if (format === "png") {
    return renderPng(domain, snapshot.state, snapshot.count, theme, headers);
  }

  const svg = renderSvg(domain, snapshot.state, snapshot.count, theme);
  return new Response(svg, { headers });
}
