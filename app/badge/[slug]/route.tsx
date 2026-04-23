import { ImageResponse } from "next/og";
import {
  BADGE_HEIGHT,
  GAP_MARK_DOMAIN,
  MARK_D,
  PAD_L,
  PAD_R,
  RING_GAP,
  RING_STROKE,
  sizeBadge,
} from "@/lib/badge-dimensions";
import {
  ringFraction,
  ringArcPath,
  resolveSnapshot,
  trustBucket,
  type BadgeSnapshot,
  type BadgeState,
} from "@/lib/badge-state";

// Badge canvas — width adapts to the domain, height stays fixed so
// the badge stays signature-compatible.
//
// Layout:   [ ring+✓ ]     [ domain ]     [ 27/100 ]
//            left           center-left    right, muted
//
// Mark leads as the state glyph (color-coded: verified fill / on-record
// outline / pending ring). The domain follows at 13px semibold — the
// focal point. The trust score sits right-aligned at 11px — large
// enough that any audience reads "27 out of 100" at a glance, muted
// enough that it doesn't compete with the domain. The ring around the
// mark fills to the same fraction, so the signal is both graphical
// (ring) and numeric (score), reinforcing each other.
const H = BADGE_HEIGHT;
const R = 8; // corner radius

// Score text helpers. Always "N/100" — numeric, locale-neutral, and
// universally understood (school grades, percent-of, review scores).
function scoreText(trustIndex: number): string {
  const n = Math.max(0, Math.min(100, Math.round(trustIndex)));
  return `${n}/100`;
}

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
type State = BadgeState;

interface Palette {
  bgTop: string;         // gradient top — subtle depth
  bgBot: string;         // gradient bottom
  border: string;
  domain: string;        // hero text
  score: string;         // "27/100" — muted-but-legible trust readout
  pendingStroke: string; // outline for the pending mark
  ringTrack: string;     // unfilled portion of the progress ring
}

// Score color sits about halfway between domain and background — light
// enough to recede next to the domain, dark enough that the number
// reads at a glance. Tuned against each theme's actual bg gradient.
const PALETTES: Record<Theme, Palette> = {
  dark: {
    bgTop: "#14141c",
    bgBot: "#08080d",
    border: "#2a2a38",
    domain: "#fafafe",
    score: "#a0a0b4",
    pendingStroke: "#6a6a7a",
    ringTrack: "#2a2a38",
  },
  light: {
    bgTop: "#ffffff",
    bgBot: "#f4f4fa",
    border: "#d8d8e4",
    domain: "#0a0a14",
    score: "#5a5a68",
    pendingStroke: "#a0a0b0",
    ringTrack: "#e4e4ee",
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

function renderSvg(
  domain: string,
  state: State,
  trustIndex: number,
  theme: Theme,
): string {
  const p = PALETTES[theme];
  const gradId = `bg-${theme}`;

  const { display, width: W } = sizeBadge(domain);
  const score = scoreText(trustIndex);

  // Positions — mark on the left, domain follows, score right-anchored.
  const markCX = PAD_L + MARK_D / 2;
  const markCY = H / 2;
  const markR = MARK_D / 2;
  const check = `M ${markCX - 4} ${markCY} L ${markCX - 1} ${markCY + 3} L ${markCX + 4} ${markCY - 3}`;

  const domainX = PAD_L + MARK_D + GAP_MARK_DOMAIN;
  // Score uses text-anchor="end" so the right edge is pinned to
  // (W - PAD_R) regardless of digit count — a 2-digit score ("27/100")
  // and a 3-digit one ("100/100") both sit flush with the canvas edge.
  const scoreX = W - PAD_R;

  // Baselines — 13px domain needs slightly more drop to sit centered
  // in the 32px canvas; 11px score rides a touch higher but shares a
  // visual baseline with the domain.
  const domainBaselineY = H / 2 + 5;
  const scoreBaselineY = H / 2 + 4;

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

  // Progress ring — the composite trust index drawn as an arc
  // around the mark. Always present so state transitions read as
  // continuous motion (0 → 65 → 100) rather than a new glyph
  // appearing. Verified is implicitly always a full circle; the
  // computeVerified gate guarantees trust_index ≥ threshold.
  const ringR = markR + RING_GAP + RING_STROKE / 2;
  const ringColor = state === "pending" ? p.pendingStroke : "#22c55e";
  const ringTrack = `<circle cx="${markCX}" cy="${markCY}" r="${ringR}" fill="none" stroke="${p.ringTrack}" stroke-width="${RING_STROKE}"/>`;
  const ringFill = ringArcPath(markCX, markCY, ringR, ringFraction(trustIndex));
  const ringEl = ringFill
    ? `${ringTrack}
    <path d="${ringFill}" fill="none" stroke="${ringColor}" stroke-width="${RING_STROKE}" stroke-linecap="round"/>`
    : ringTrack;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${stateAria(state)}, trust ${Math.round(trustIndex)}/100)">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bgTop}"/>
      <stop offset="100%" stop-color="${p.bgBot}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="url(#${gradId})" stroke="${p.border}" stroke-width="1"/>${ringEl}${markEl}
  <text x="${domainX}" y="${domainBaselineY}" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="13" font-weight="600" fill="${p.domain}" letter-spacing="-0.01em">${esc(display)}</text>
  <text x="${scoreX}" y="${scoreBaselineY}" text-anchor="end" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="11" font-weight="500" fill="${p.score}" letter-spacing="0.01em">${score}</text>
</svg>`;
}

// PNG variant — renders the same badge via next/og so it embeds
// cleanly in email signatures (Gmail, Outlook, Apple Mail).
function renderPng(
  domain: string,
  state: State,
  trustIndex: number,
  theme: Theme,
  cacheHeaders: Record<string, string>
) {
  const p = PALETTES[theme];
  const { display, width: W } = sizeBadge(domain);

  // Rendered at 2× for retina crispness.
  const PNG_W = W * 2;
  const PNG_H = H * 2;

  // All mark + ring dimensions doubled to match the 2× render space.
  const markSize = MARK_D * 2;
  const markR = markSize / 2;

  // Ring geometry — same concept as the SVG path, but expressed as a
  // full circle with stroke-dasharray. Satori's SVG subset handles
  // <circle> + stroke-dasharray + transform reliably; it does NOT
  // reliably handle <path> arc commands (`A`), so the progress arc
  // has to be built from a dashed full circle rotated to start at
  // 12 o'clock.
  const ringR2x = (MARK_D / 2 + RING_GAP + RING_STROKE / 2) * 2;
  const ringStroke2x = RING_STROKE * 2;
  const ringBoxSize = Math.ceil(ringR2x * 2 + ringStroke2x * 2 + 4);
  const ringCenter = ringBoxSize / 2;
  const ringCircumference = 2 * Math.PI * ringR2x;
  const fraction = ringFraction(trustIndex);
  const filledLen = fraction * ringCircumference;
  const ringColor = state === "pending" ? p.pendingStroke : "#22c55e";
  const checkPath = `M ${ringCenter - 8} ${ringCenter} L ${ringCenter - 2} ${ringCenter + 6} L ${ringCenter + 8} ${ringCenter - 6}`;

  // Mark layers — drawn as siblings of the ring inside a single
  // <svg>. No React Fragments: Satori's SVG children pipeline is
  // fussier than the browser's.
  let markInner: React.ReactNode = null;
  let markOuter: React.ReactNode = null;
  if (state === "verified") {
    markOuter = (
      <circle
        cx={ringCenter}
        cy={ringCenter}
        r={markR}
        fill="#22c55e"
      />
    );
    markInner = (
      <path
        d={checkPath}
        stroke={p.bgBot}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  } else if (state === "onRecord") {
    markOuter = (
      <circle
        cx={ringCenter}
        cy={ringCenter}
        r={markR - 1.5}
        fill="none"
        stroke="#16a34a"
        strokeWidth="3"
      />
    );
    markInner = (
      <path
        d={checkPath}
        stroke="#16a34a"
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  } else {
    markOuter = (
      <circle
        cx={ringCenter}
        cy={ringCenter}
        r={markR - 1.5}
        fill="none"
        stroke={p.pendingStroke}
        strokeWidth="3"
      />
    );
  }

  const markNode: React.ReactNode = (
    <svg
      width={ringBoxSize}
      height={ringBoxSize}
      viewBox={`0 0 ${ringBoxSize} ${ringBoxSize}`}
    >
      {/* Track — full, muted circle */}
      <circle
        cx={ringCenter}
        cy={ringCenter}
        r={ringR2x}
        fill="none"
        stroke={p.ringTrack}
        strokeWidth={ringStroke2x}
      />
      {/* Progress — dash-array slice rotated to start at 12 o'clock */}
      {fraction > 0.005 && (
        <circle
          cx={ringCenter}
          cy={ringCenter}
          r={ringR2x}
          fill="none"
          stroke={ringColor}
          strokeWidth={ringStroke2x}
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${ringCircumference}`}
          transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
        />
      )}
      {markOuter}
      {markInner}
    </svg>
  );

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
        {/* Mark + domain cluster — left-anchored */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: GAP_MARK_DOMAIN * 2,
          }}
        >
          {markNode}
          <span
            style={{
              color: p.domain,
              fontSize: 26,
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
        </div>

        {/* Trust score — right-anchored, muted-but-legible. 22px at
            2× ≈ 11px on screen, matching the SVG. Font weight 500
            keeps the number readable without out-shouting the domain. */}
        <span
          style={{
            color: p.score,
            fontSize: 22,
            fontWeight: 500,
            fontFamily: "monospace",
            lineHeight: 1,
            letterSpacing: 0.2,
            whiteSpace: "nowrap",
          }}
        >
          {scoreText(trustIndex)}
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

type Snapshot = BadgeSnapshot;

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
export function cacheHeaders(
  snapshot: Snapshot,
  theme: Theme,
  format: "svg" | "png"
): Record<string, string> {
  // Cache key incorporates the trust index bucketed to 5-point bins.
  // Without the bin, every recompute would bust the CDN even for a
  // 1-point drift; with it, transitions are coarse enough to keep
  // hit rates high while still picking up meaningful progress.
  // Bumped to v8 — witnessed.cc brand text replaced with "N/100"
  // trust readout. Old v7 ETags would otherwise 304 into the stale
  // layout.
  const bucket = trustBucket(snapshot.trustIndex);
  const etag = `W/"${snapshot.state}-t${bucket}-${theme}-${format}-v8"`;
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

  const url = new URL(request.url);
  const theme: Theme =
    url.searchParams.get("theme") === "light" ? "light" : "dark";

  // `?preview=<state>` short-circuits the DB lookup and renders the
  // requested state directly. Used by marketing surfaces (e.g. the
  // landing page's signature mock) so a fake demo domain still shows
  // an attractive "verified" badge without polluting the real registry.
  // Never mutates data; read-only presentation toggle.
  const previewParam = url.searchParams.get("preview");
  const previewState: State | null =
    previewParam === "verified" ||
    previewParam === "onRecord" ||
    previewParam === "pending"
      ? previewParam
      : null;

  // `?t=<0..100>` lets preview surfaces drive the ring fraction
  // without touching the DB. Clamped inside ringFraction.
  const previewTrustRaw = url.searchParams.get("t");
  const previewTrustIndex = previewTrustRaw !== null
    ? Number.parseInt(previewTrustRaw, 10)
    : undefined;

  const defaultTrustForState = (s: State): number =>
    s === "verified" ? 100 : s === "onRecord" ? 55 : 0;

  const snapshot: Snapshot = previewState
    ? {
        state: previewState,
        count: 0,
        trustIndex: Number.isFinite(previewTrustIndex)
          ? (previewTrustIndex as number)
          : defaultTrustForState(previewState),
      }
    : await resolveSnapshot(domain);
  const headers = cacheHeaders(snapshot, theme, format);

  // Conditional GET — respond 304 when the caller (CDN, Gmail proxy, browser)
  // already has the same (state, theme, trust-bucket) fingerprint.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === headers.ETag) {
    return new Response(null, { status: 304, headers });
  }

  if (format === "png") {
    return renderPng(domain, snapshot.state, snapshot.trustIndex, theme, headers);
  }

  const svg = renderSvg(domain, snapshot.state, snapshot.trustIndex, theme);
  return new Response(svg, { headers });
}
