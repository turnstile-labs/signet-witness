import { readFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import {
  BADGE_HEIGHT,
  BADGE_THEMES,
  DEFAULT_BADGE_THEME,
  GAP_ICON_TEXT,
  ICON_D,
  LEFT_W,
  PAD_L,
  PAD_R,
  STATE_WORDS,
  isBadgeTheme,
  rightWidthFor,
  truncateDomain,
  type BadgeTheme,
} from "@/lib/badge-dimensions";
import {
  resolveSnapshot,
  type BadgeSnapshot,
  type BadgeState,
} from "@/lib/badge-state";

// Split Pill (current ETag: v18).
//
//   ┌──────────────────┬──────────────────┐
//   │  ✓  Verified     │     acme.com     │
//   └──────────────────┴──────────────────┘
//
// LEFT half  — state-tinted bg (green for Verified, amber for Building)
//              + white icon + white state word. Constant 104px.
// RIGHT half — theme-aware neutral bg + monospace domain text.
//              Width adapts to the domain. The brand attribution lives
//              in the click target (`witnessed.cc/b/<domain>`), not
//              in pixels.
//
// A 1px divider sits at LEFT_W. Outer rounded-full clipping gives the
// pill its signature shape; the divider stays straight inside the clip.
//
// `?theme=light|dark` flips the RIGHT half palette. Default is `dark`
// (back-compat for any badge URL emitted before v16). LEFT half does
// NOT theme — the saturated state color IS the state's identity.

const H = BADGE_HEIGHT;
const R = BADGE_HEIGHT / 2; // pill (rounded-full)

// Bold monospace bundled and shipped to Satori so the PNG path renders
// in the same intentional typography as the SVG path. Without this,
// `next/og`/Satori silently falls back to its built-in Noto Sans for
// any `fontFamily` value — no matter what we declare — and the badge
// reads thin and washed in the surfaces that embed the PNG (the seal
// page preview, signature paste targets, etc.).
//
// `new URL(..., import.meta.url)` is the Next.js-blessed way to pin
// a static asset into the route's deployment trace so it's bundled
// alongside the function on Vercel. The read happens once at module
// init and the bytes stay in memory for every subsequent request.
//
// JetBrains Mono Bold is OFL 1.1 (license shipped at
// `app/badge/fonts/OFL.txt`).
const JETBRAINS_MONO_BOLD = readFileSync(
  new URL("./fonts/JetBrainsMono-Bold.ttf", import.meta.url),
);

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
// reads from `BADGE_THEMES[theme]` (see `lib/badge-dimensions.ts`).
interface LeftPalette {
  bg: string;
  fg: string;
  iconNotch: string;
}

const STATE_PALETTES: Record<BadgeState, LeftPalette> = {
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
function renderSvg(domain: string, state: BadgeState, theme: BadgeTheme): string {
  const p = STATE_PALETTES[state];
  const t = BADGE_THEMES[theme];
  const stateWord = STATE_WORDS[state];
  const domainText = truncateDomain(domain);
  const rightW = rightWidthFor(domain);
  const W = LEFT_W + rightW;

  // Icon centred on the LEFT half's icon column.
  const iconCX = PAD_L + ICON_D / 2;
  const iconCY = H / 2;
  const iconR = ICON_D / 2;

  // State word baseline starts after the icon + gap.
  const stateX = PAD_L + ICON_D + GAP_ICON_TEXT;

  // Right half: domain centred horizontally inside its half.
  const rightCenterX = LEFT_W + rightW / 2;

  // 13px monospace digits sit ~5px below the centre line for mid-cap
  // alignment on a 32px canvas. Stack leads with `ui-monospace` so we
  // pick up SF Mono on macOS/iOS, Cascadia/Consolas on Windows, and
  // the platform-native mono on Linux instead of falling through to
  // a generic monospace that often renders thinner than designed.
  const baselineY = H / 2 + 4.5;
  const textFont = `font-family="ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace" font-size="13" letter-spacing="-0.01em"`;

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
    <rect x="${LEFT_W}" y="0" width="${rightW}" height="${H}" fill="${t.rightBg}"/>
    <line x1="${LEFT_W}" y1="0" x2="${LEFT_W}" y2="${H}" stroke="${t.border}" stroke-width="1" stroke-opacity="0.55"/>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R - 0.5}" fill="none" stroke="${t.border}" stroke-width="1" stroke-opacity="0.55"/>${iconEl}
  <text x="${stateX}" y="${baselineY}" ${textFont} font-weight="800" fill="${p.fg}">${esc(stateWord)}</text>
  <text x="${rightCenterX}" y="${baselineY}" ${textFont} font-weight="700" fill="${t.rightFg}" text-anchor="middle">${esc(domainText)}</text>
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
  theme: BadgeTheme,
  cacheHeaders: Record<string, string>,
) {
  const p = STATE_PALETTES[state];
  const t = BADGE_THEMES[theme];
  const stateWord = STATE_WORDS[state];
  const domainText = truncateDomain(domain);
  const rightW = rightWidthFor(domain);
  const W = LEFT_W + rightW;

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
          border: `1px solid ${t.border}`,
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
              fontFamily: "JetBrains Mono",
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
        {/* RIGHT — neutral half carrying the domain */}
        <div
          style={{
            display: "flex",
            width: rightW * 2,
            height: "100%",
            backgroundColor: t.rightBg,
            alignItems: "center",
            justifyContent: "center",
            paddingRight: PAD_R * 2,
            paddingLeft: PAD_R * 2,
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono",
              fontWeight: 700,
              fontSize: 26,
              color: t.rightFg,
              lineHeight: 1,
              letterSpacing: -0.2,
            }}
          >
            {domainText}
          </span>
        </div>
      </div>
    ),
    {
      width: PNG_W,
      height: PNG_H,
      headers: cacheHeaders,
      fonts: [
        {
          name: "JetBrains Mono",
          data: JETBRAINS_MONO_BOLD,
          weight: 700,
          style: "normal",
        },
      ],
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
// The ETag is keyed on `(state, theme, format, layout-version)`. Different
// URLs already key by domain, so the domain itself doesn't enter the ETag.
//
//   v13 = Split Pill (state half + neutral platform half, embedded
//         domain dropped). Right half = "witnessed.cc" wordmark.
//   v14 = Tightened canvas + warm-neutral dark for the right half
//         (slate-900 → stone-900).
//   v15 = LEFT_W bump (96→104) to clear "Verified" from the divider.
//   v16 = Right half = the actual domain (was a fixed witnessed.cc
//         wordmark). Theme variance reintroduced (`?theme=light|dark`).
//         Width is now domain-adaptive.
//   v17 = Bolder text — state word 700→800, domain 600→700, plus a
//         `ui-monospace`-leading font stack so we land on the platform's
//         native bold mono (SF Mono / Cascadia / JetBrains) instead of
//         the generic monospace fallback that was rendering washed.
//   v18 = PNG path now ships JetBrains Mono Bold to Satori. Previously
//         Satori was silently rendering the PNG in its bundled Noto
//         Sans regardless of `fontFamily` (because no font bytes had
//         been loaded), which is why the seal page badge stayed thin
//         even after v17. SVG path is unchanged in v18.
export function cacheHeaders(
  snapshot: Snapshot,
  format: "svg" | "png",
  theme: BadgeTheme,
): Record<string, string> {
  const etag = `W/"${snapshot.state}-${theme}-${format}-v18"`;
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

  // `?theme=light|dark` flips the RIGHT half palette. Default falls
  // back to dark so any badge URL emitted before v16 keeps rendering.
  const themeParam = url.searchParams.get("theme");
  const theme: BadgeTheme = isBadgeTheme(themeParam)
    ? themeParam
    : DEFAULT_BADGE_THEME;

  const snapshot: Snapshot = previewState
    ? { state: previewState, count: 0 }
    : await resolveSnapshot(domain);
  const headers = cacheHeaders(snapshot, format, theme);

  // Conditional GET — respond 304 when the caller (CDN, Gmail proxy,
  // browser) already has the same (state, theme, format) fingerprint.
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
