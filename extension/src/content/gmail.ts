/**
 * Gmail content script (v0.3).
 *
 * Scope:
 *   1. Write side — auto-BCC seal@witnessed.cc into every new compose.
 *   2. Read probe — when the popup asks, report the sender domain of the
 *      currently-open thread (or conversation) so the popup can render a
 *      live "proof of business" card for that domain.
 *
 * We deliberately do NOT inject any UI into Gmail's DOM. Gmail owns its
 * inbox rows aggressively and any element we attach gets recycled with
 * the row on hover/selection/new-mail. The popup surface is stable,
 * belongs to us, and pops identically over inbox or conversation view.
 */

import {
  SEAL_ADDRESS,
  COMPOSE_DEBOUNCE_MS,
  PRODUCT_NAME,
} from "../lib/constants";
import {
  bumpInjectedCount,
  getSettings,
  onSettingsChange,
} from "../lib/storage";
import { emailToDomain } from "../lib/parse";

const COMPOSE_PROCESSED = "data-witnessed-processed";
const LOG_PREFIX = `[${PRODUCT_NAME.toLowerCase()}]`;
const BUILD_TAG = "v0.4.0";
const MAX_VISIBLE_DOMAINS = 25;

let injectEnabled = true;

function debugEnabled(): boolean {
  try {
    return localStorage.getItem("witnessedDebug") === "1";
  } catch {
    return false;
  }
}

function debug(...args: unknown[]): void {
  if (debugEnabled()) console.log(LOG_PREFIX, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

function info(...args: unknown[]): void {
  console.info(LOG_PREFIX, ...args);
}

// ── Write side ────────────────────────────────────────────────

function findUnprocessedComposes(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>(
    `div[role="dialog"]:not([${COMPOSE_PROCESSED}])`,
  );
  const result: HTMLElement[] = [];
  for (const dialog of dialogs) {
    if (
      dialog.querySelector(
        'input[name="subjectbox"], textarea[name="subjectbox"]',
      )
    ) {
      result.push(dialog);
    }
  }
  return result;
}

function findBccInput(
  dialog: HTMLElement,
): HTMLInputElement | HTMLTextAreaElement | null {
  return dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input[aria-label^="Bcc" i], textarea[aria-label^="Bcc" i], input[name="bcc"], textarea[name="bcc"]',
  );
}

function sealAlreadyAdded(dialog: HTMLElement): boolean {
  const bccRow = dialog
    .querySelector<HTMLElement>('[aria-label*="Bcc" i]')
    ?.closest("tr, div");
  const scope = bccRow ?? dialog;
  return scope.textContent?.includes(SEAL_ADDRESS) ?? false;
}

function expandBccRow(dialog: HTMLElement): void {
  if (findBccInput(dialog)) return;

  const candidates = dialog.querySelectorAll<HTMLElement>(
    '[role="link"], [role="button"], span, button',
  );
  for (const candidate of candidates) {
    const aria = (candidate.getAttribute("aria-label") ?? "")
      .trim()
      .toLowerCase();
    const text = (candidate.textContent ?? "").trim().toLowerCase();
    const matchesAria =
      /^(add\s+)?bcc\b/.test(aria) ||
      aria === "bcc" ||
      aria.includes("bcc recipients");
    const matchesText = text === "bcc";
    if (!(matchesAria || matchesText)) continue;
    // Skip the label on an already-expanded row.
    const inExpandedRow = candidate
      .closest('tr[role="presentation"]')
      ?.querySelector(
        'input[aria-label^="Bcc" i], textarea[aria-label^="Bcc" i]',
      );
    if (inExpandedRow) continue;
    candidate.click();
    return;
  }

  // Keyboard-shortcut fallback (only fires if the user has enabled Gmail
  // shortcuts — cheap no-op otherwise).
  const subject = dialog.querySelector<HTMLElement>(
    'input[name="subjectbox"], textarea[name="subjectbox"]',
  );
  if (subject) {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    subject.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        code: "KeyB",
        keyCode: 66,
        which: 66,
        ctrlKey: !isMac,
        metaKey: isMac,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

function insertSealChip(
  input: HTMLInputElement | HTMLTextAreaElement,
): void {
  input.focus();
  const ok = document.execCommand("insertText", false, SEAL_ADDRESS);
  if (!ok) {
    input.value = SEAL_ADDRESS;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
    }),
  );
  input.blur();
}

function processCompose(dialog: HTMLElement): boolean {
  if (!injectEnabled) return true;
  if (dialog.hasAttribute(COMPOSE_PROCESSED)) return true;

  expandBccRow(dialog);
  const input = findBccInput(dialog);
  if (!input) return false;

  if (sealAlreadyAdded(dialog)) {
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    return true;
  }

  try {
    insertSealChip(input);
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    void bumpInjectedCount();
    debug("sealed compose");
    return true;
  } catch (err) {
    warn("insert failed", err);
    return false;
  }
}

function scanComposes(): void {
  for (const dialog of findUnprocessedComposes()) processCompose(dialog);
}

// ── Read probe ────────────────────────────────────────────────
// Runs only when the popup asks; no UI side effects.
//
// Pure parsing helpers (e.g. `emailToDomain`) live in `../lib/parse`
// so they can be unit-tested without dragging Gmail's DOM into the
// test runtime.

export type VisibleContext = "thread" | "list" | "none";

export interface VisibleDomainEntry {
  domain: string;
  source: "thread" | "row";
}

export interface VisibleDomainsReply {
  domains: VisibleDomainEntry[];
  context: VisibleContext;
}

/**
 * Returns every unique sender domain the user can see right now.
 *
 *   - If a conversation is open, returns the domain of every message
 *     sender in that thread (one chat can involve several counterparties
 *     — each one deserves its own "proof of business" chip).
 *   - Otherwise (inbox list view), returns the sender domain of every
 *     visible inbox row, in the order Gmail renders them.
 *
 * Results are de-duplicated and capped at MAX_VISIBLE_DOMAINS so an
 * overfilled inbox doesn't make the popup slow to render.
 */
function getVisibleDomains(): VisibleDomainsReply {
  const seen = new Map<string, VisibleDomainEntry>();
  const main = document.querySelector<HTMLElement>('[role="main"]');

  // 1) Thread view — senders of the messages in the open conversation.
  //    We identify them by `span[email]` inside the main pane that is
  //    NOT inside an inbox row (`tr.zA`), so we don't accidentally
  //    pick up list-row senders in split-pane layouts.
  if (main) {
    const emailSpans = main.querySelectorAll<HTMLElement>("span[email]");
    for (const el of emailSpans) {
      if (el.closest("tr.zA")) continue;
      const d = emailToDomain(el.getAttribute("email"));
      if (d && !seen.has(d)) {
        seen.set(d, { domain: d, source: "thread" });
        if (seen.size >= MAX_VISIBLE_DOMAINS) break;
      }
    }
    // Fallback: some Gmail variants carry the sender on the hovercard.
    if (seen.size === 0) {
      const cards = main.querySelectorAll<HTMLElement>(
        "h3 [data-hovercard-id], [role='heading'] [data-hovercard-id]",
      );
      for (const el of cards) {
        const d = emailToDomain(el.getAttribute("data-hovercard-id"));
        if (d && !seen.has(d)) {
          seen.set(d, { domain: d, source: "thread" });
          if (seen.size >= MAX_VISIBLE_DOMAINS) break;
        }
      }
    }
  }

  if (seen.size > 0) {
    return { domains: Array.from(seen.values()), context: "thread" };
  }

  // 2) Inbox list view — every visible row's sender domain, in document
  //    order so the popup mirrors what the user is reading top-to-bottom.
  const rows = document.querySelectorAll<HTMLElement>("tr.zA");
  for (const row of rows) {
    const span = row.querySelector<HTMLElement>("span[email]");
    const d = emailToDomain(span?.getAttribute("email"));
    if (d && !seen.has(d)) {
      seen.set(d, { domain: d, source: "row" });
      if (seen.size >= MAX_VISIBLE_DOMAINS) break;
    }
  }
  if (seen.size > 0) {
    return { domains: Array.from(seen.values()), context: "list" };
  }

  return { domains: [], context: "none" };
}

// ── Observer / message bridge ─────────────────────────────────

let composePending = false;

function scheduleComposeScan(): void {
  if (composePending) return;
  composePending = true;
  setTimeout(() => {
    composePending = false;
    scanComposes();
  }, COMPOSE_DEBOUNCE_MS);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return false;
  const kind = (msg as { kind?: string }).kind;
  if (kind === "GET_VISIBLE_DOMAINS") {
    try {
      sendResponse(getVisibleDomains());
    } catch (err) {
      warn("visible-domains probe failed", err);
      sendResponse({ domains: [], context: "none" });
    }
    return true; // keep channel open until sendResponse is called (sync here)
  }
  if (kind === "PING") {
    sendResponse({ ok: true, build: BUILD_TAG });
    return true;
  }
  return false;
});

async function boot(): Promise<void> {
  const settings = await getSettings();
  injectEnabled = settings.enabled;

  info(`${BUILD_TAG} booted`, {
    inject: injectEnabled,
    href: location.pathname + location.hash,
  });

  onSettingsChange((next) => {
    if (typeof next.enabled === "boolean") injectEnabled = next.enabled;
  });

  const observer = new MutationObserver(() => scheduleComposeScan());
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleComposeScan();
}

boot().catch((err) => warn("boot failed", err));
