import { ImageResponse } from "next/og";
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  GAP_ICON_TEXT,
  ICON_D,
  LEFT_W,
  PAD_L,
  PAD_R,
  PLATFORM_LABEL,
  RIGHT_W,
  STATE_WORDS,
} from "@/lib/badge-dimensions";
import {
  resolveSnapshot,
  type BadgeSnapshot,
  type BadgeState,
} from "@/lib/badge-state";

// v13 — Split Pill.
//
//   ┌──────────────────┬──────────────────┐
//   │  ✓  Verified     │   witnessed.cc   │
//   └──────────────────┴──────────────────┘
//
// LEFT half  — state-tinted bg (green for Verified, amber for Building)
//              + white icon + white state word. The variable half.
// RIGHT half — slate-900 bg + light text "witnessed.cc". The immutable
//              platform mark. Identical for every badge in the world.
//
// A 1px divider sits at LEFT_W. Outer rounded-full clipping gives the
// pill its signature shape; the divider stays straight inside the clip.
//
// No embedded domain text — the URL still encodes which domain to look
// up (`/badge/acme.com.png`), but the rendered output is constant width
// and constant content per state. See `lib/badge-dimensions.ts` for the
// rationale.

const H = BADGE_HEIGHT;
const W = BADGE_WIDTH;
const R = BADGE_HEIGHT / 2; // pill (rounded-full)

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

// XML-escape strings before injecting into the SVG source.
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

// ── Palette ─────────────────────────────────────────────────
//
// Two tones per state on the LEFT half: a solid background for the
// state tint and a foreground colour for icon/text. The RIGHT half
// is constant — slate-900 bg, slate-100 text — so the platform mark
// reads as immutable across every state and every email-client theme.
interface Palette {
  bg: string;     // LEFT half background
  fg: string;     // LEFT half text + icon
  iconNotch: string; // inner notch colour for the icon (matches bg)
}

const PALETTES: Record<BadgeState, Palette> = {
  verified: {
    bg: "#16a34a",          // emerald
    fg: "#ffffff",
    iconNotch: "#16a34a",
  },
  building: {
    bg: "#d97706",          // amber
    fg: "#ffffff",
    iconNotch: "#d97706",
  },
};

// v14 — warm-neutral dark for the right half.
//
// The previous slate-900 (#0f172a) was a cool blue-black that fought
// both state colours: it pulled the eye away from the warm amber
// (Building) and crushed against the cool emerald (Verified). Stone-900
// is a warm-neutral charcoal — no blue, no green, no purple — so it
// sits underneath whichever state half is paired with it without
// clashing. Same role as the slate it replaces: the immutable platform
// half. Just calibrated to sit in the brand's palette properly.
const RIGHT_BG = "#1c1917";    // stone-900 (warm charcoal)
const RIGHT_FG = "#f5f5f4";    // stone-100
const BORDER   = "#0c0a09";    // stone-950 (subtle outer + divider)

function stateAria(state: BadgeState): string {
  switch (state) {
    case "verified": return "verified";
    case "building": return "building";
  }
}

// ── SVG ─────────────────────────────────────────────────────
//
// Authored as raw SVG (not Satori) for two reasons: it's a tiny string
// payload (no wasm warmup), and the clip-path + line primitives give
// the cleanest split rendering across browsers and email clients.
function renderSvg(domain: string, state: BadgeState): string {
  const p = PALETTES[state];
  const stateWord = STATE_WORDS[state];

  // Icon centred on the LEFT half's icon column.
  const iconCX = PAD_L + ICON_D / 2;
  const iconCY = H / 2;
  const iconR = ICON_D / 2;

  // State word baseline starts after the icon + gap.
  const stateX = PAD_L + ICON_D + GAP_ICON_TEXT;

  // Right half: wordmark centred horizontally inside its half.
  const rightCenterX = LEFT_W + RIGHT_W / 2;

  // 13px monospace digits sit ~5px below the centre line for mid-cap
  // alignment on a 32px canvas. Holds across SF Mono / Menlo / Consolas.
  const baselineY = H / 2 + 4.5;
  const textFont = `font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="13" letter-spacing="-0.01em"`;

  let iconEl: string;
  if (state === "verified") {
    const check = `M ${iconCX - 3.5} ${iconCY} L ${iconCX - 1} ${iconCY + 2.5} L ${iconCX + 3.5} ${iconCY - 2.5}`;
    iconEl = `
    <circle cx="${iconCX}" cy="${iconCY}" r="${iconR}" fill="${p.fg}"/>
    <path d="${check}" stroke="${p.iconNotch}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    iconEl = `
    <circle cx="${iconCX}" cy="${iconCY}" r="${iconR}" fill="${p.fg}"/>
    <circle cx="${iconCX}" cy="${iconCY}" r="1.6" fill="${p.iconNotch}"/>`;
  }

  // The clip-path lets the two solid halves meet at LEFT_W with a
  // hard edge while the outer pill stays rounded.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${stateAria(state)})">
  <defs>
    <clipPath id="pill">
      <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" ry="${R}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#pill)">
    <rect x="0" y="0" width="${LEFT_W}" height="${H}" fill="${p.bg}"/>
    <rect x="${LEFT_W}" y="0" width="${RIGHT_W}" height="${H}" fill="${RIGHT_BG}"/>
    <line x1="${LEFT_W}" y1="0" x2="${LEFT_W}" y2="${H}" stroke="${BORDER}" stroke-width="1" stroke-opacity="0.55"/>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R - 0.5}" fill="none" stroke="${BORDER}" stroke-width="1" stroke-opacity="0.4"/>${iconEl}
  <text x="${stateX}" y="${baselineY}" ${textFont} font-weight="700" fill="${p.fg}">${esc(stateWord)}</text>
  <text x="${rightCenterX}" y="${baselineY}" ${textFont} font-weight="600" fill="${RIGHT_FG}" text-anchor="middle">${esc(PLATFORM_LABEL)}</text>
</svg>`;
}

// ── PNG (next/og + Satori) ──────────────────────────────────
//
// Email clients (Gmail, Outlook, Apple Mail) embed PNGs more reliably
// than SVGs, especially in pasted signatures. We render at 2× density
// and rely on the `<img width=…>` hint shipped by `BadgeEmbed` to
// display at intrinsic size.
function renderPng(
  domain: string,
  state: BadgeState,
  cacheHeaders: Record<string, string>,
) {
  const p = PALETTES[state];
  const stateWord = STATE_WORDS[state];

  const PNG_W = W * 2;
  const PNG_H = H * 2;
  const iconD2x = ICON_D * 2;
  const iconR2x = iconD2x / 2;

  // Icon node — drawn as a standalone <svg> so Satori's flexbox can
  // align it with the state word along the main axis.
  const iconNode =
    state === "verified" ? (
      <svg width={iconD2x} height={iconD2x} viewBox={`0 0 ${iconD2x} ${iconD2x}`}>
        <circle cx={iconR2x} cy={iconR2x} r={iconR2x} fill={p.fg} />
        <path
          d={`M ${iconR2x - 7} ${iconR2x} L ${iconR2x - 2} ${iconR2x + 5} L ${iconR2x + 7} ${iconR2x - 5}`}
          stroke={p.iconNotch}
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg width={iconD2x} height={iconD2x} viewBox={`0 0 ${iconD2x} ${iconD2x}`}>
        <circle cx={iconR2x} cy={iconR2x} r={iconR2x} fill={p.fg} />
        <circle cx={iconR2x} cy={iconR2x} r="3.2" fill={p.iconNotch} />
      </svg>
    );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          borderRadius: R * 2,
          border: `1px solid ${BORDER}`,
          overflow: "hidden",
          fontFamily: "monospace",
          boxSizing: "border-box",
        }}
        aria-label={`Witnessed badge: ${domain} (${stateAria(state)})`}
      >
        {/* LEFT — state-tinted half */}
        <div
          style={{
            display: "flex",
            width: LEFT_W * 2,
            height: "100%",
            backgroundColor: p.bg,
            alignItems: "center",
            paddingLeft: PAD_L * 2,
            gap: GAP_ICON_TEXT * 2,
          }}
        >
          {iconNode}
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: 26,
              color: p.fg,
              lineHeight: 1,
              letterSpacing: -0.2,
            }}
          >
            {stateWord}
          </span>
        </div>
        {/* RIGHT — neutral platform half */}
        <div
          style={{
            display: "flex",
            width: RIGHT_W * 2,
            height: "100%",
            backgroundColor: RIGHT_BG,
            alignItems: "center",
            justifyContent: "center",
            paddingRight: PAD_R * 2,
            paddingLeft: PAD_R * 2,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 600,
              fontSize: 26,
              color: RIGHT_FG,
              lineHeight: 1,
              letterSpacing: -0.2,
            }}
          >
            {PLATFORM_LABEL}
          </span>
        </div>
      </div>
    ),
    {
      width: PNG_W,
      height: PNG_H,
      headers: cacheHeaders,
    },
  );
}

type Snapshot = BadgeSnapshot;

// ── Caching ─────────────────────────────────────────────────
//
// Aggressive-but-friendly caching for email embeds.
//
//   max-age=60           — browsers / Apple Mail refresh at most every minute
//   s-maxage=120         — Vercel edge caches 2 min, keeping origin hits low
//   stale-while-revalidate=3600
//                        — edge serves last version while re-fetching in the
//                          background, so users never wait on a cold cache
//
// The ETag is keyed on `(state, format, layout-version)`. State is the
// only variable now; the layout version moves only on a real visual
// redesign.
//   v13 = Split Pill (state half + neutral platform half, no embedded
//         domain text).
//   v14 = Tightened canvas (224→204) and warm-neutral dark for the
//         right half (slate-900 → stone-900). Same shape, calibrated
//         proportions and palette for email-client rendering.
export function cacheHeaders(
  snapshot: Snapshot,
  format: "svg" | "png",
): Record<string, string> {
  const etag = `W/"${snapshot.state}-${format}-v14"`;
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

export const revalidate = 0;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const { domain, format } = parseSlug(slug);

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return new Response("invalid domain", { status: 400 });
  }

  const url = new URL(request.url);

  // `?preview=<state>` short-circuits the DB lookup and renders the
  // requested state directly. Used by marketing surfaces (e.g. the
  // landing page's signature mock) so a fake demo domain still shows
  // an attractive "verified" badge without polluting the real
  // registry. Read-only presentation toggle.
  const previewParam = url.searchParams.get("preview");
  const previewState: BadgeState | null =
    previewParam === "verified" || previewParam === "building"
      ? previewParam
      : null;

  const snapshot: Snapshot = previewState
    ? { state: previewState, count: 0 }
    : await resolveSnapshot(domain);
  const headers = cacheHeaders(snapshot, format);

  // Conditional GET — respond 304 when the caller (CDN, Gmail proxy,
  // browser) already has the same (state, format) fingerprint.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  if (format === "png") {
    return renderPng(domain, snapshot.state, headers);
  }

  const svg = renderSvg(domain, snapshot.state);
  return new Response(svg, { headers });
}
