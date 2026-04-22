import { getDomain } from "@/lib/db";
import { ImageResponse } from "next/og";
import {
  BADGE_HEIGHT,
  BRAND_TEXT,
  BRAND_WIDTH,
  GAP_BRAND_MARK,
  MARK_D,
  PAD_L,
  PAD_R,
  sizeBadge,
} from "@/lib/badge-dimensions";

// Verified thresholds — mirrors the seal page.
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// Badge canvas — width adapts to the domain, height stays fixed so
// the badge stays signature-compatible.
//
// Layout:   [ domain ]     [ witnessed.cc ]     [ ✓ ]
//            left, bold     middle, muted        right, color-coded
//
// The brand sits "almost hidden" in the middle — enough to attribute
// provenance (this is a Witnessed badge), but muted so the domain
// keeps focal priority. The checkmark at the end reads as a sign-off.
const H = BADGE_HEIGHT;
const R = 8; // corner radius

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
  bgTop: string;         // gradient top — subtle depth
  bgBot: string;         // gradient bottom
  border: string;
  domain: string;        // hero text
  brand: string;         // "witnessed.cc" — muted attribution
  pendingStroke: string; // outline for the pending mark
}

// Brand color sits ~3 luminance steps above the background, so it's
// legible on close inspection but recedes at a glance. Tuned against
// each theme's actual bg gradient.
const PALETTES: Record<Theme, Palette> = {
  dark: {
    bgTop: "#14141c",
    bgBot: "#08080d",
    border: "#2a2a38",
    domain: "#fafafe",
    brand: "#5a5a6a",
    pendingStroke: "#6a6a7a",
  },
  light: {
    bgTop: "#ffffff",
    bgBot: "#f4f4fa",
    border: "#d8d8e4",
    domain: "#0a0a14",
    brand: "#9a9aa8",
    pendingStroke: "#a0a0b0",
  },
};

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

  const { display, width: W } = sizeBadge(domain);

  // Positions — right-anchor the mark, then the brand just to its left,
  // with the domain taking the remaining left-hand space.
  const markCX = W - PAD_R - MARK_D / 2;
  const markCY = H / 2;
  const markR = MARK_D / 2;
  const check = `M ${markCX - 4} ${markCY} L ${markCX - 1} ${markCY + 3} L ${markCX + 4} ${markCY - 3}`;

  const brandRightEdge = W - PAD_R - MARK_D - GAP_BRAND_MARK;
  const brandX = brandRightEdge - BRAND_WIDTH;

  const domainX = PAD_L;
  const domainBaselineY = H / 2 + 4;
  const brandBaselineY = H / 2 + 3;

  let markEl = "";
  if (state === "verified") {
    markEl = `
    <circle cx="${markCX}" cy="${markCY}" r="${markR}" fill="#22c55e"/>
    <path d="${check}" stroke="${p.bgBot}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (state === "onRecord") {
    markEl = `
    <circle cx="${markCX}" cy="${markCY}" r="${markR - 0.75}" fill="none" stroke="#16a34a" stroke-width="1.5"/>
    <path d="${check}" stroke="#16a34a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    markEl = `
    <circle cx="${markCX}" cy="${markCY}" r="${markR - 0.75}" fill="none" stroke="${p.pendingStroke}" stroke-width="1.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${stateAria(state)})">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bgTop}"/>
      <stop offset="100%" stop-color="${p.bgBot}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="url(#${gradId})" stroke="${p.border}" stroke-width="1"/>
  <text x="${domainX}" y="${domainBaselineY}" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="12" font-weight="600" fill="${p.domain}" letter-spacing="-0.01em">${esc(display)}</text>
  <text x="${brandX}" y="${brandBaselineY}" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="9" font-weight="400" fill="${p.brand}" letter-spacing="0.02em">${BRAND_TEXT}</text>${markEl}
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
  const { display, width: W } = sizeBadge(domain);

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
          justifyContent: "space-between",
          padding: `0 ${PAD_R * 2}px 0 ${PAD_L * 2}px`,
          fontFamily: "monospace",
          boxSizing: "border-box",
        }}
      >
        {/* Domain — focal point, left-anchored */}
        <span
          style={{
            color: p.domain,
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "monospace",
            lineHeight: 1,
            letterSpacing: -0.2,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {display}
        </span>

        {/* Brand + mark cluster — right-anchored */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: GAP_BRAND_MARK * 2,
          }}
        >
          <span
            style={{
              color: p.brand,
              fontSize: 18,
              fontWeight: 400,
              fontFamily: "monospace",
              lineHeight: 1,
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
            }}
          >
            {BRAND_TEXT}
          </span>
          {markNode}
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
// control, but a short max-age plus an ETag keyed on (state, theme)
// means it *can* revalidate cheaply and pick up state transitions
// (pending → onRecord → verified) within hours.
function cacheHeaders(
  snapshot: Snapshot,
  theme: Theme,
  format: "svg" | "png"
): Record<string, string> {
  // Cache key omits the live count (the badge doesn't render it) and
  // the width (derived from the URL path's domain, which is already
  // the primary cache key). Bumped to v4 with the brand+mark redesign.
  const etag = `W/"${snapshot.state}-${theme}-${format}-v4"`;
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
