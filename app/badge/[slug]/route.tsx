import { getDomain } from "@/lib/db";
import { ImageResponse } from "next/og";

// Verified thresholds — mirrors the seal page.
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// Badge canvas — compact signature-ready object. Sized for email
// signatures: tall enough to feel like a deliberate object (not a
// stretched label), narrow enough to sit beside a name + role block
// without dominating. Aspect ratio ~6.9:1 reads as a "badge", not a
// "pill". PNG is rendered at 2× for retina crispness; the HTML
// snippet still displays it at W × H logical pixels.
const W = 220;
const H = 32;
const R = 8; // corner radius
const MARK_D = 16; // mark diameter
const MARK_CX = 16; // mark center x (padding 8 + radius 8)

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
  bgTop: string;     // gradient top — subtle depth
  bgBot: string;     // gradient bottom
  border: string;
  domain: string;    // hero text
  pendingStroke: string; // outline for the pending mark
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bgTop: "#14141c",
    bgBot: "#08080d",
    border: "#2a2a38",
    domain: "#fafafe",
    pendingStroke: "#6a6a7a",
  },
  light: {
    bgTop: "#ffffff",
    bgBot: "#f4f4fa",
    border: "#d8d8e4",
    domain: "#0a0a14",
    pendingStroke: "#a0a0b0",
  },
};

function truncateDomain(domain: string, maxChars: number): string {
  return domain.length > maxChars
    ? domain.slice(0, Math.max(1, maxChars - 1)) + "…"
    : domain;
}

// State description for aria-label. The mark + color carry the signal
// visually; this ensures screen readers still get the semantics.
function stateAria(state: State): string {
  switch (state) {
    case "verified": return "verified";
    case "onRecord": return "on record";
    case "pending":  return "no record";
  }
}

function renderSvg(domain: string, state: State, theme: Theme): string {
  const p = PALETTES[theme];
  const gradId = `bg-${theme}`;

  // Typography metrics — SF Mono ~7.2px per char at 12px. Count is gone,
  // so the domain gets the full canvas minus the mark area and side padding.
  const domainStartX = 32; // mark_width(16) + padding_left(8) + gap(8)
  const reservedRight = 12;
  const availableDomainW = W - domainStartX - reservedRight;
  const domainCharW = 7.2;
  const maxDomainChars = Math.max(4, Math.floor(availableDomainW / domainCharW));
  const displayDomain = truncateDomain(domain, maxDomainChars);

  // Mark geometry — centered vertically in the 32px canvas.
  const markCY = H / 2;
  const markR = MARK_D / 2;
  // Checkmark path: enters bottom-left, dips, exits upper-right.
  // Scaled to fit inside the 16px mark with comfortable margins.
  const check = `M ${MARK_CX - 4} ${markCY} L ${MARK_CX - 1} ${markCY + 3} L ${MARK_CX + 4} ${markCY - 3}`;

  let markEl = "";
  if (state === "verified") {
    markEl = `
    <circle cx="${MARK_CX}" cy="${markCY}" r="${markR}" fill="#22c55e"/>
    <path d="${check}" stroke="${p.bgBot}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (state === "onRecord") {
    markEl = `
    <circle cx="${MARK_CX}" cy="${markCY}" r="${markR - 0.75}" fill="none" stroke="#16a34a" stroke-width="1.5"/>
    <path d="${check}" stroke="#16a34a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    markEl = `
    <circle cx="${MARK_CX}" cy="${markCY}" r="${markR - 0.75}" fill="none" stroke="${p.pendingStroke}" stroke-width="1.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${stateAria(state)})">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bgTop}"/>
      <stop offset="100%" stop-color="${p.bgBot}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="url(#${gradId})" stroke="${p.border}" stroke-width="1"/>${markEl}
  <text x="${domainStartX}" y="${H / 2 + 4}" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="12" font-weight="600" fill="${p.domain}" letter-spacing="-0.01em">${esc(displayDomain)}</text>
</svg>`;
}

// PNG variant — renders the same badge via next/og so it embeds
// cleanly in email signatures (Gmail, Outlook, Apple Mail).
function renderPng(
  domain: string,
  state: State,
  theme: Theme,
  cacheHeaders: Record<string, string>
) {
  const p = PALETTES[theme];
  const displayDomain = truncateDomain(domain, 24);

  // Rendered at 2× for retina crispness.
  const PNG_W = W * 2;
  const PNG_H = H * 2;

  // Mark SVG inline — Satori supports basic SVG shapes and paths.
  // All mark dimensions doubled to match the 2× render space.
  const markSize = MARK_D * 2;
  const markCheckPath = `M ${markSize / 2 - 8} ${markSize / 2} L ${markSize / 2 - 2} ${markSize / 2 + 6} L ${markSize / 2 + 8} ${markSize / 2 - 6}`;

  let markNode: React.ReactNode;
  if (state === "verified") {
    markNode = (
      <svg
        width={markSize}
        height={markSize}
        viewBox={`0 0 ${markSize} ${markSize}`}
      >
        <circle
          cx={markSize / 2}
          cy={markSize / 2}
          r={markSize / 2}
          fill="#22c55e"
        />
        <path
          d={markCheckPath}
          stroke={p.bgBot}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  } else if (state === "onRecord") {
    markNode = (
      <svg
        width={markSize}
        height={markSize}
        viewBox={`0 0 ${markSize} ${markSize}`}
      >
        <circle
          cx={markSize / 2}
          cy={markSize / 2}
          r={markSize / 2 - 1.5}
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
        />
        <path
          d={markCheckPath}
          stroke="#16a34a"
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  } else {
    markNode = (
      <svg
        width={markSize}
        height={markSize}
        viewBox={`0 0 ${markSize} ${markSize}`}
      >
        <circle
          cx={markSize / 2}
          cy={markSize / 2}
          r={markSize / 2 - 1.5}
          fill="none"
          stroke={p.pendingStroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundImage: `linear-gradient(to bottom, ${p.bgTop}, ${p.bgBot})`,
          borderRadius: R * 2,
          border: `2px solid ${p.border}`,
          alignItems: "center",
          padding: "0 20px 0 16px",
          fontFamily: "sans-serif",
          boxSizing: "border-box",
        }}
      >
        {markNode}

        <span
          style={{
            color: p.domain,
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "monospace",
            lineHeight: 1,
            letterSpacing: -0.2,
            marginLeft: 16,
            flex: 1,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {displayDomain}
        </span>
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
// control, but a short max-age plus an ETag keyed on (state, theme)
// means it *can* revalidate cheaply and pick up state transitions
// (pending → onRecord → verified) within hours.
function cacheHeaders(
  snapshot: Snapshot,
  theme: Theme,
  format: "svg" | "png"
): Record<string, string> {
  // Count no longer appears on the badge — cache key omits it so edge
  // and client caches stay stable across every-email updates. The
  // state field already captures threshold transitions (pending →
  // onRecord → verified), which is the only thing that changes the
  // rendered output.
  const etag = `W/"${snapshot.state}-${theme}-${format}-v3"`;
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
  // already has the same (state, theme) fingerprint.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  if (format === "png") {
    return renderPng(domain, snapshot.state, theme, headers);
  }

  const svg = renderSvg(domain, snapshot.state, theme);
  return new Response(svg, { headers });
}
