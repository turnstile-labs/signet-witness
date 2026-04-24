import type { DomainState, PublicPayload } from "./types";

/**
 * DOM factory for the inline sender-status pill rendered in Gmail rows.
 *
 * Design constraints:
 *   - Tiny: must not push Gmail's layout around. A 6px circle + optional
 *     short label on hover.
 *   - Colour-coded to match /b/[domain] state tones (verified=green,
 *     onRecord=amber, pending/unclaimed=muted gray).
 *   - Every pill links to witnessed.cc/b/<domain> so a curious user can
 *     follow it straight to the seal page. Opens in a new tab so we
 *     never steal them out of their inbox.
 *   - Accessible: has title + aria-label describing the state so screen
 *     readers read it properly.
 *
 * The pill carries a `data-witnessed-state` attribute so we can detect
 * re-renders and refresh the colour without rebuilding the DOM node.
 */

const PILL_CLASS = "witnessed-pill";
const TONE: Record<DomainState, { color: string; label: string }> = {
  verified: { color: "#22c55e", label: "Verified on Witnessed" },
  onRecord: { color: "#f59e0b", label: "On record on Witnessed" },
  pending: { color: "#7c6af7", label: "Pending on Witnessed" },
  // `unclaimed` is visible but intentionally desaturated — most inbox
  // rows will be unclaimed at first, so a hollow ring reads as "not yet"
  // at a glance without turning the inbox into a sea of colour.
  unclaimed: { color: "#9ca3af", label: "Not on Witnessed yet" },
  error: { color: "transparent", label: "" },
};

/**
 * Inject the stylesheet once per document. We scope the styles by a
 * data-attribute so Gmail's own CSS can't bleed in and we don't leak
 * styles onto the page.
 */
export function ensureStylesheet(): void {
  const MARK = "witnessed-pill-stylesheet";
  if (document.getElementById(MARK)) return;
  const style = document.createElement("style");
  style.id = MARK;
  // `!important` on size/display is a defence against Gmail's
  // catch-all anchor styles (underline, padding, line-height) that can
  // otherwise collapse a 10px flex dot into nothing.
  style.textContent = `
    .${PILL_CLASS} {
      display: inline-block !important;
      width: 10px !important;
      height: 10px !important;
      min-width: 10px !important;
      border-radius: 50% !important;
      margin: 0 6px 0 0 !important;
      padding: 0 !important;
      vertical-align: middle !important;
      text-decoration: none !important;
      flex-shrink: 0;
      cursor: help;
      transition: transform 120ms ease, box-shadow 120ms ease;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
    }
    .${PILL_CLASS}:hover { transform: scale(1.3); }
    .${PILL_CLASS}[data-witnessed-state="verified"]  { box-shadow: 0 0 0 1.5px rgba(34,197,94,0.45); }
    .${PILL_CLASS}[data-witnessed-state="onRecord"]  { box-shadow: 0 0 0 1.5px rgba(245,158,11,0.45); }
    .${PILL_CLASS}[data-witnessed-state="pending"]   { box-shadow: 0 0 0 1.5px rgba(124,106,247,0.5); }
    .${PILL_CLASS}[data-witnessed-state="unclaimed"] {
      background-color: transparent !important;
      border: 1.5px solid #9ca3af;
      box-shadow: none;
    }
    .${PILL_CLASS}[data-witnessed-state="error"]     { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Build (or update) a pill node for the given payload. Returns null for
 * the `error` state so callers can skip rendering entirely.
 */
export function buildPill(payload: PublicPayload): HTMLElement | null {
  if (payload.state === "error") return null;

  ensureStylesheet();
  const tone = TONE[payload.state];
  const pill = document.createElement("a");
  pill.className = PILL_CLASS;
  pill.dataset.witnessedState = payload.state;
  pill.dataset.witnessedDomain = payload.domain;
  pill.style.backgroundColor = tone.color;

  const score =
    payload.trustIndex !== null ? ` · ${payload.trustIndex}/100` : "";
  const label = `${tone.label} — ${payload.domain}${score}`;
  pill.title = label;
  pill.setAttribute("aria-label", label);

  pill.href = `https://witnessed.cc/b/${encodeURIComponent(payload.domain)}`;
  pill.target = "_blank";
  pill.rel = "noopener noreferrer";
  pill.addEventListener("click", (e) => e.stopPropagation());

  return pill;
}

/** Mark attribute so we don't re-query the same row or node repeatedly. */
export const ROW_PROCESSED_ATTR = "data-witnessed-row";
export const PILL_CLASS_NAME = PILL_CLASS;
