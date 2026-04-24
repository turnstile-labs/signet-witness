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
  verified: { color: "#4ade80", label: "Verified on Witnessed" },
  onRecord: { color: "#f59e0b", label: "On record on Witnessed" },
  pending: { color: "#7c6af7", label: "Pending on Witnessed" },
  unclaimed: { color: "#60607a", label: "Not on Witnessed yet" },
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
  style.textContent = `
    .${PILL_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 8px;
      height: 8px;
      min-width: 8px;
      border-radius: 50%;
      margin: 0 6px 0 0;
      vertical-align: middle;
      cursor: help;
      transition: transform 120ms ease;
    }
    .${PILL_CLASS}:hover { transform: scale(1.35); }
    .${PILL_CLASS}[data-witnessed-state="verified"] { box-shadow: 0 0 0 1px rgba(74,222,128,0.35); }
    .${PILL_CLASS}[data-witnessed-state="onRecord"] { box-shadow: 0 0 0 1px rgba(245,158,11,0.35); }
    .${PILL_CLASS}[data-witnessed-state="pending"]  { box-shadow: 0 0 0 1px rgba(124,106,247,0.4); }
    .${PILL_CLASS}[data-witnessed-state="unclaimed"]{ box-shadow: 0 0 0 1px rgba(96,96,122,0.45); opacity: 0.7; }
    .${PILL_CLASS}[data-witnessed-state="error"] { display: none; }
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
