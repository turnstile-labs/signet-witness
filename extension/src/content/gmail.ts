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
  COMPOSE_POLL_MS,
  PRODUCT_NAME,
} from "../lib/constants";
import {
  bumpInjectedCount,
  getSettings,
  onSettingsChange,
} from "../lib/storage";
import { emailToDomain, isFreeMailDomain } from "../lib/parse";

const COMPOSE_PROCESSED = "data-witnessed-processed";
const LOG_PREFIX = `[${PRODUCT_NAME.toLowerCase()}]`;
const BUILD_TAG = "v0.4.3";
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

// Localised "Bcc" labels Gmail uses across its supported UI languages.
// Sorted by language family. Patterns are intentionally tight to avoid
// accidental matches on body copy ("BCC" in the surrounding sentence,
// for example) — they're tested against the *trimmed* text content of
// candidate elements only, which Gmail keeps to the 2–4 character chip.
//
// Expanded after a Spanish-locale user reported auto-BCC silently
// failing on every compose: our previous matcher was English-only
// (`bcc`) and missed `Cco` entirely, so we never clicked the toggle,
// the row stayed collapsed, and the seal was inserted into the
// hidden textarea where Gmail's React state ignored it.
//
// Add to this list when a new locale ships in Gmail. Keep diacritics
// lowercased because we lowercase before testing.
const BCC_LABEL_PATTERNS: ReadonlyArray<RegExp> = [
  /^bcc\b/, // en, de, nl, ja-JP (alt), ko (alt), zh-Hant (alt)
  /^cco\b/, // es, pt-BR, pt-PT
  /^cci\b/, // fr
  /^ccn\b/, // it
  /密送/, // zh-CN (also "密件抄送")
  /密件/, // zh-Hant
  /숨은참조/, // ko
  /скрытая/, // ru
  /скр\.?/, // ru (short)
  /副本密送/, // zh (alt)
];

function matchesBccLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return BCC_LABEL_PATTERNS.some((p) => p.test(t));
}

function expandBccRow(dialog: HTMLElement): void {
  // If the Bcc textarea is already in the live tree (visible *or* hidden)
  // and is in an expanded row we can write to, leave it alone — clicking
  // the toggle a second time would collapse it.
  const existing = findBccInput(dialog);
  if (existing && existing.offsetParent !== null) return;

  const candidates = dialog.querySelectorAll<HTMLElement>(
    '[role="link"], [role="button"], span, button',
  );
  for (const candidate of candidates) {
    const aria = candidate.getAttribute("aria-label") ?? "";
    const text = candidate.textContent ?? "";
    if (!matchesBccLabel(aria) && !matchesBccLabel(text)) continue;
    // Skip the label on an already-expanded row.
    const inExpandedRow = candidate
      .closest('tr[role="presentation"]')
      ?.querySelector('input[name="bcc"], textarea[name="bcc"]');
    if (inExpandedRow) continue;
    // Some Gmail variants attach React-style listeners that only respond
    // to the full `mousedown → mouseup → click` triple. A bare `.click()`
    // works in most builds, but firing the triple is cheap insurance and
    // matches what a real user click looks like.
    try {
      candidate.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      candidate.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      candidate.click();
    } catch {
      /* node may have been recycled mid-frame; next mutation will retry */
    }
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
  // The Bcc textarea exists in the DOM even when the row is collapsed
  // (Gmail toggles the parent `<tr>`'s display, not the textarea). If we
  // try to insert into a hidden field, `document.execCommand("insertText")`
  // returns true on some Chromium builds but Gmail's React state never
  // syncs, so the seal silently disappears when the user expands Bcc
  // manually. Defer to the next mutation tick — once the row expands,
  // `offsetParent` becomes non-null and we can write safely.
  if (input.offsetParent === null) return false;

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

  // Free-mail senders are filtered out before they ever reach the popup.
  // gmail.com / outlook.com / yahoo.com et al. are multi-tenant consumer
  // providers — they can't earn a domain reputation in our model and
  // the server rejects them at intake. Surfacing them in the popup as
  // perpetual "Unclaimed" rows is misleading noise that crowds out the
  // business senders that actually have signal.
  function admit(d: string | null): d is string {
    return d !== null && !isFreeMailDomain(d);
  }

  // 1) Thread view — senders of the messages in the open conversation.
  //    We identify them by `span[email]` inside the main pane that is
  //    NOT inside an inbox row (`tr.zA`), so we don't accidentally
  //    pick up list-row senders in split-pane layouts.
  if (main) {
    const emailSpans = main.querySelectorAll<HTMLElement>("span[email]");
    for (const el of emailSpans) {
      if (el.closest("tr.zA")) continue;
      const d = emailToDomain(el.getAttribute("email"));
      if (admit(d) && !seen.has(d)) {
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
        if (admit(d) && !seen.has(d)) {
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
    if (admit(d) && !seen.has(d)) {
      seen.set(d, { domain: d, source: "row" });
      if (seen.size >= MAX_VISIBLE_DOMAINS) break;
    }
  }
  if (seen.size > 0) {
    return { domains: Array.from(seen.values()), context: "list" };
  }

  return { domains: [], context: "none" };
}

// ── Compose scanner / message bridge ──────────────────────────
//
// The scanner runs on a fixed interval (`COMPOSE_POLL_MS`) instead of
// reacting to DOM mutations. See the long-form note in
// `lib/constants.ts` for *why* — short version: a global subtree
// observer on Gmail is the difference between "auto-BCC works" and
// "Gmail freezes on busy inboxes".

let pollHandle: number | undefined;

function safeScan(): void {
  try {
    scanComposes();
  } catch (err) {
    // A single bad scan must not kill the loop — Gmail occasionally
    // recycles a dialog mid-walk, throwing on stale node refs. Logged
    // once per failure so the dev console still flags repeated breakage.
    warn("compose scan failed", err);
  }
}

function startScanner(): void {
  if (pollHandle !== undefined) return;
  pollHandle = window.setInterval(() => {
    if (document.hidden) return;
    safeScan();
  }, COMPOSE_POLL_MS);
  // Run once immediately so a freshly-opened compose doesn't have to
  // wait the full interval before being sealed.
  safeScan();
}

function stopScanner(): void {
  if (pollHandle === undefined) return;
  window.clearInterval(pollHandle);
  pollHandle = undefined;
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

  startScanner();

  // Catch the user coming back to the tab after composing in another
  // window — we paused on hide, so resume on show with an immediate
  // scan instead of waiting up to a full interval.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    safeScan();
  });

  // Free the timer when the page goes away (SPA navigation inside
  // Gmail keeps the same content script, but a hard reload would
  // otherwise leak the interval into the about-to-be-destroyed
  // document for a frame).
  window.addEventListener("pagehide", stopScanner, { once: true });
}

boot().catch((err) => warn("boot failed", err));
