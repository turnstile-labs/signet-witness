import { ImageResponse } from "next/og";
import {
  BADGE_HEIGHT,
  GAP_ICON_DOMAIN,
  ICON_D,
  PAD_L,
  PAD_R,
  SEP_W,
  STATE_WORDS,
  STATE_W_RESERVED,
  sizeBadge,
} from "@/lib/badge-dimensions";
import {
  resolveSnapshot,
  type BadgeSnapshot,
  type BadgeState,
} from "@/lib/badge-state";

// Badge canvas — width adapts to the domain, height stays fixed so
// the badge stays signature-compatible. Layout:
//
//   [ icon ]  [ STATE WORD ]  ·  [ domain ]
//
// Verified: filled green pill, white check icon, bold "Verified", white domain.
// Building: filled amber pill, white dot icon,   bold "Building", white domain.
//
// Two tiers, no third "Pending" variant. We collapsed Pending into
// Building on every public surface in v12 — the distinction was
// meaningful in code (DKIM-passed-event count) but unreadable to a
// stranger looking at a badge in a signature, and the tiny class of
// domains that genuinely stuck in Pending (broken DKIM) is an
// operator concern, not a customer-facing one. The /ops dashboard
// still surfaces the three-state breakdown; everything outside ops
// is binary.
//
// No progress ring, no score readout, no theme param. The color +
// state word do all the work, and the badge's identity stays stable
// on any email client bg, dark or light.
const H = BADGE_HEIGHT;
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

interface Palette {
  bg: string;        // pill fill ("transparent" for outline variants)
  border: string;    // pill stroke
  text: string;      // state word + domain color
  icon: string;      // icon color (stroke / fill)
  iconBg: string;    // inner fill for filled-icon variants (bg notch)
}

// One palette per state. Fixed across light/dark email-client themes —
// the badge's color IS the state, so it stays stable on any bg. Hex
// values picked to contrast well on both white and near-black surfaces
// (gmail light/dark, apple mail, outlook).
const PALETTES: Record<BadgeState, Palette> = {
  verified: {
    bg: "#16a34a",          // solid green
    border: "#15803d",
    text: "#ffffff",
    icon: "#ffffff",
    iconBg: "#16a34a",
  },
  onRecord: {
    bg: "#d97706",          // solid amber
    border: "#b45309",
    text: "#ffffff",
    icon: "#ffffff",
    iconBg: "#d97706",
  },
};

function stateAria(state: BadgeState): string {
  switch (state) {
    case "verified": return "verified";
    case "onRecord": return "building";
  }
}

function renderSvg(domain: string, state: BadgeState): string {
  const p = PALETTES[state];
  const { display, width: W } = sizeBadge(domain);
  const stateWord = STATE_WORDS[state];

  const iconCX = PAD_L + ICON_D / 2;
  const iconCY = H / 2;
  const iconR = ICON_D / 2;

  // Three-column text layout anchored at fixed x offsets so the
  // domain starts at the same x across every state. Stable vertical
  // column = stable pixel width across the Building → Verified
  // transition.
  const stateX = PAD_L + ICON_D + GAP_ICON_DOMAIN;
  // Separator sits centred inside the 3-char SEP_W gap between the
  // state slot and the domain.
  const sepX = stateX + STATE_W_RESERVED + SEP_W / 2;
  const domainX = stateX + STATE_W_RESERVED + SEP_W;

  // 13px monospace digits sit ~5px below the centre line for mid-
  // cap alignment on a 32px canvas. Holds across SF Mono / Menlo /
  // Consolas / JetBrains Mono.
  const textBaselineY = H / 2 + 4.5;

  const textFont = `font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="13" letter-spacing="-0.01em"`;

  let iconEl = "";
  if (state === "verified") {
    const check = `M ${iconCX - 3.5} ${iconCY} L ${iconCX - 1} ${iconCY + 2.5} L ${iconCX + 3.5} ${iconCY - 2.5}`;
    iconEl = `
    <circle cx="${iconCX}" cy="${iconCY}" r="${iconR}" fill="${p.icon}"/>
    <path d="${check}" stroke="${p.iconBg}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    iconEl = `
    <circle cx="${iconCX}" cy="${iconCY}" r="${iconR}" fill="${p.icon}"/>
    <circle cx="${iconCX}" cy="${iconCY}" r="1.6" fill="${p.iconBg}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${stateAria(state)})">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="${p.bg}" stroke="${p.border}" stroke-width="1"/>${iconEl}
  <text x="${stateX}" y="${textBaselineY}" ${textFont} font-weight="700" fill="${p.text}">${esc(stateWord)}</text>
  <text x="${sepX}" y="${textBaselineY}" ${textFont} font-weight="400" fill="${p.text}" fill-opacity="0.75" text-anchor="middle">·</text>
  <text x="${domainX}" y="${textBaselineY}" ${textFont} font-weight="600" fill="${p.text}">${esc(display)}</text>
</svg>`;
}

// Padding on each side of the `·` separator in the PNG (2× logical px).
// Mirrors the SEP_W budget (3 chars × 2 = 6 units per side in the 2×
// render space, split as " · ").
const DOMAIN_SEP_PAD = 6;

// PNG variant — renders via next/og so it embeds cleanly in email
// signatures (Gmail, Outlook, Apple Mail).
function renderPng(
  domain: string,
  state: BadgeState,
  cacheHeaders: Record<string, string>,
) {
  const p = PALETTES[state];
  const { display, width: W } = sizeBadge(domain);
  const stateWord = STATE_WORDS[state];

  // Rendered at 2× for retina crispness.
  const PNG_W = W * 2;
  const PNG_H = H * 2;

  // Icon scaled for the 2× render space.
  const iconD2x = ICON_D * 2;
  const iconR2x = iconD2x / 2;

  // Icon renders as a standalone <svg> child so Satori's flexbox
  // layout can position it on the main axis alongside the text.
  let iconNode: React.ReactNode;
  if (state === "verified") {
    iconNode = (
      <svg width={iconD2x} height={iconD2x} viewBox={`0 0 ${iconD2x} ${iconD2x}`}>
        <circle cx={iconR2x} cy={iconR2x} r={iconR2x} fill={p.icon} />
        <path
          d={`M ${iconR2x - 7} ${iconR2x} L ${iconR2x - 2} ${iconR2x + 5} L ${iconR2x + 7} ${iconR2x - 5}`}
          stroke={p.iconBg}
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  } else {
    iconNode = (
      <svg width={iconD2x} height={iconD2x} viewBox={`0 0 ${iconD2x} ${iconD2x}`}>
        <circle cx={iconR2x} cy={iconR2x} r={iconR2x} fill={p.icon} />
        <circle cx={iconR2x} cy={iconR2x} r="3.2" fill={p.iconBg} />
      </svg>
    );
  }

  // Reserved state-word slot keeps badge width stable across state
  // transitions — we always render a fixed-width box around the
  // actual state word, left-aligned, so "Building" (8 chars) and
  // "Verified" (8 chars) produce the same overall canvas for a
  // given domain.
  const stateSlotW = STATE_W_RESERVED * 2;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: p.bg,
          borderRadius: R * 2,
          border: `2px solid ${p.border}`,
          alignItems: "center",
          justifyContent: "flex-start",
          padding: `0 ${PAD_R * 2}px 0 ${PAD_L * 2}px`,
          gap: GAP_ICON_DOMAIN * 2,
          fontFamily: "monospace",
          boxSizing: "border-box",
        }}
      >
        {iconNode}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: 26,
            color: p.text,
            lineHeight: 1,
            letterSpacing: -0.2,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              width: stateSlotW,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {stateWord}
          </span>
          <span
            style={{
              fontWeight: 400,
              opacity: 0.75,
              padding: `0 ${DOMAIN_SEP_PAD}px`,
            }}
          >
            ·
          </span>
          <span
            style={{
              fontWeight: 600,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {display}
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

// Aggressive-but-friendly caching for email embeds.
//
//   max-age=60           — browsers / Apple Mail refresh at most every minute
//   s-maxage=120         — Vercel edge caches 2 min, keeping origin hits low
//   stale-while-revalidate=3600
//                        — edge serves last version while re-fetching in the
//                          background, so users never wait on a cold cache
//
// The ETag is keyed on `(state, format, layout-version)`. State is
// the only thing that changes the pixels now — no trust bucket, no
// theme — so cache hit rates are effectively perfect per domain and
// the only CDN bust is a real state transition.
export function cacheHeaders(
  snapshot: Snapshot,
  format: "svg" | "png",
): Record<string, string> {
  // v12: collapsed Pending into Building on every public surface.
  // The badge now has two tiers (Verified / Building) with no third
  // outline variant — Pending domains render as Building from this
  // version on. Bust caches everywhere so in-the-wild signatures
  // pick up the new rendering.
  const etag = `W/"${snapshot.state}-${format}-v12"`;
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
  // registry. Never mutates data; read-only presentation toggle.
  const previewParam = url.searchParams.get("preview");
  const previewState: BadgeState | null =
    previewParam === "verified" || previewParam === "onRecord"
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
