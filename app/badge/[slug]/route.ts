import { getDomain } from "@/lib/db";

// Verified thresholds — mirrors the seal page.
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// Badge canvas — compact single-line pill sized for an email signature.
// Width is fixed so the resulting <img> has a stable aspect ratio across clients.
const W = 360;
const H = 40;

// Accept slugs like "acme.com" or "acme.com.svg" — the latter makes the
// URL read naturally as an image ("src='.../badge/acme.com.svg'").
function parseDomain(slug: string): string {
  return decodeURIComponent(slug.replace(/\.svg$/i, ""))
    .toLowerCase()
    .trim();
}

// XML-escape user-supplied domain text before injecting into the SVG source.
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
type State = "verified" | "building" | "pending";

interface Palette {
  bg: string;
  border: string;
  mark: string;
  brand: string;
  sep: string;
  domain: string;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: "#0c0c0f",
    border: "#25252f",
    mark: "#7c6af7",
    brand: "#e8e8f2",
    sep: "#60607a",
    domain: "#e8e8f2",
  },
  light: {
    bg: "#ffffff",
    border: "#e0e0ec",
    mark: "#6252e8",
    brand: "#18181e",
    sep: "#9090b0",
    domain: "#18181e",
  },
};

function stateStyle(state: State): {
  dot: string;
  text: string;
  fill: string;
  stroke: string;
  label: string;
} {
  switch (state) {
    case "verified":
      return {
        dot: "#22c55e",
        text: "#16a34a",
        fill: "#16a34a1a",
        stroke: "#16a34a4d",
        label: "VERIFIED",
      };
    case "building":
      return {
        dot: "#f59e0b",
        text: "#b45309",
        fill: "#f59e0b1a",
        stroke: "#f59e0b4d",
        label: "BUILDING",
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

function renderSvg(domain: string, state: State, theme: Theme): string {
  const p = PALETTES[theme];
  const s = stateStyle(state);

  // Truncate long domains so the pill layout never collapses.
  const displayDomain =
    domain.length > 22 ? domain.slice(0, 21) + "…" : domain;

  // Right-aligned status pill dimensions.
  const pillW = 92;
  const pillH = 22;
  const pillX = W - 14 - pillW;
  const pillY = (H - pillH) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${s.label.toLowerCase()})">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${p.bg}" stroke="${p.border}"/>

  <!-- Mark -->
  <text x="16" y="26" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="${p.mark}">✦</text>

  <!-- Brand -->
  <text x="34" y="25" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="${p.brand}" letter-spacing="-0.01em">Witnessed</text>

  <!-- Separator -->
  <text x="106" y="25" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${p.sep}">·</text>

  <!-- Domain -->
  <text x="116" y="25" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="11" fill="${p.domain}">${esc(displayDomain)}</text>

  <!-- Status pill -->
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${s.fill}" stroke="${s.stroke}"/>
  <circle cx="${pillX + 12}" cy="${pillY + pillH / 2}" r="3" fill="${s.dot}"/>
  <text x="${pillX + 22}" y="${pillY + pillH / 2 + 3.5}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="700" letter-spacing="0.08em" fill="${s.text}">${s.label}</text>
</svg>`;
}

async function resolveState(domain: string): Promise<State> {
  try {
    const record = await getDomain(domain);
    if (!record) return "pending";
    const days = Math.floor(
      (Date.now() - new Date(record.first_seen).getTime()) / 86_400_000
    );
    if (days >= VERIFIED_DAYS && record.event_count >= VERIFIED_EMAILS) {
      return "verified";
    }
    return "building";
  } catch {
    return "pending";
  }
}

export const revalidate = 300;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const domain = parseDomain(slug);

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return new Response("invalid domain", { status: 400 });
  }

  const theme: Theme =
    new URL(request.url).searchParams.get("theme") === "light"
      ? "light"
      : "dark";

  const state = await resolveState(domain);
  const svg = renderSvg(domain, state, theme);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      // Allow embedding anywhere (email clients, other sites).
      "Access-Control-Allow-Origin": "*",
    },
  });
}
