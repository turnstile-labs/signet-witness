import { getDomain } from "@/lib/db";
import { ImageResponse } from "next/og";

// Verified thresholds — mirrors the seal page.
const VERIFIED_DAYS = 90;
const VERIFIED_EMAILS = 10;

// Badge canvas — compact single-line pill sized for email signatures.
const W = 360;
const H = 40;

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

function truncateDomain(domain: string): string {
  return domain.length > 22 ? domain.slice(0, 21) + "…" : domain;
}

function renderSvg(domain: string, state: State, theme: Theme): string {
  const p = PALETTES[theme];
  const s = stateStyle(state);
  const displayDomain = truncateDomain(domain);

  const pillW = 92;
  const pillH = 22;
  const pillX = W - 14 - pillW;
  const pillY = (H - pillH) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnessed badge: ${esc(domain)} (${s.label.toLowerCase()})">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${p.bg}" stroke="${p.border}"/>
  <text x="16" y="26" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="${p.mark}">✦</text>
  <text x="34" y="25" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="${p.brand}" letter-spacing="-0.01em">Witnessed</text>
  <text x="106" y="25" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${p.sep}">·</text>
  <text x="116" y="25" font-family="'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="11" fill="${p.domain}">${esc(displayDomain)}</text>
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${s.fill}" stroke="${s.stroke}"/>
  <circle cx="${pillX + 12}" cy="${pillY + pillH / 2}" r="3" fill="${s.dot}"/>
  <text x="${pillX + 22}" y="${pillY + pillH / 2 + 3.5}" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="700" letter-spacing="0.08em" fill="${s.text}">${s.label}</text>
</svg>`;
}

// PNG variant — renders the same badge via next/og so it embeds
// cleanly in email signatures (Gmail, Outlook, Apple Mail).
function renderPng(domain: string, state: State, theme: Theme) {
  const p = PALETTES[theme];
  const s = stateStyle(state);
  const displayDomain = truncateDomain(domain);

  // Rendered at 2× (720×80) and displayed at 360×40 for retina crispness.
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
          borderRadius: 20,
          border: `2px solid ${p.border}`,
          alignItems: "center",
          padding: "0 28px",
          fontFamily: "sans-serif",
          boxSizing: "border-box",
        }}
      >
        {/* Mark — drawn as inline SVG so we don't depend on fonts */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          style={{ marginRight: 14 }}
        >
          <polygon
            points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5"
            fill={p.mark}
          />
        </svg>

        <span
          style={{
            color: p.brand,
            fontSize: 26,
            fontWeight: 700,
            marginRight: 14,
            letterSpacing: -0.5,
          }}
        >
          Witnessed
        </span>

        <span style={{ color: p.sep, fontSize: 22, marginRight: 14 }}>·</span>

        <span style={{ color: p.domain, fontSize: 22, fontFamily: "monospace" }}>
          {displayDomain}
        </span>

        <div style={{ display: "flex", flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "9px 22px",
            borderRadius: 999,
            background: s.fill,
            border: `2px solid ${s.stroke}`,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: s.dot,
              marginRight: 10,
            }}
          />
          <span
            style={{
              color: s.text,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1.6,
            }}
          >
            {s.label}
          </span>
        </div>
      </div>
    ),
    {
      width: PNG_W,
      height: PNG_H,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
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
  const { domain, format } = parseSlug(slug);

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return new Response("invalid domain", { status: 400 });
  }

  const theme: Theme =
    new URL(request.url).searchParams.get("theme") === "light"
      ? "light"
      : "dark";

  const state = await resolveState(domain);

  if (format === "png") {
    return renderPng(domain, state, theme);
  }

  const svg = renderSvg(domain, state, theme);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
