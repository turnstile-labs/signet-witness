/**
 * Gmail content script.
 *
 * Two responsibilities:
 *   1. Write-side: watch for new compose dialogs and inject
 *      seal@witnessed.cc into the Bcc field. (Shipped in v0.1.)
 *   2. Read-side: watch the inbox list and render a small status pill
 *      next to each sender's name indicating their current Witnessed
 *      state (Verified / OnRecord / Pending / Unclaimed). (New in v0.2.)
 *
 * Everything is defensive: Gmail ships DOM tweaks often, every selector
 * has a fallback, and every failure is swallowed with console.debug so
 * the user's mail flow is never interrupted.
 */

import {
  SEAL_ADDRESS,
  COMPOSE_DEBOUNCE_MS,
  INBOX_DEBOUNCE_MS,
  PRODUCT_NAME,
} from "../lib/constants";
import {
  bumpInjectedCount,
  getSettings,
  onSettingsChange,
} from "../lib/storage";
import { lookupDomain } from "../lib/api";
import {
  buildPill,
  ensureStylesheet,
  PILL_CLASS_NAME,
  ROW_PROCESSED_ATTR,
} from "../lib/pill";

const COMPOSE_PROCESSED = "data-witnessed-processed";
const LOG_PREFIX = `[${PRODUCT_NAME.toLowerCase()}]`;
const BUILD_TAG = "v0.2.3";

let injectEnabled = true;
let statusEnabled = true;
let firstScanLogged = false;
/** Counter of "explain-the-first-N-rows" diagnostic logs. We dump full
 *  detail for the first handful of rows after boot so a one-shot reload
 *  reveals exactly where each domain's pipeline stopped (extracted? looked
 *  up? pill inserted?). After N rows we fall silent unless the user flips
 *  `localStorage.witnessedDebug = '1'`. */
const EXPLAIN_FIRST_N = 12;
let explained = 0;

function debugEnabled(): boolean {
  try {
    return localStorage.getItem("witnessedDebug") === "1";
  } catch {
    /* localStorage blocked in some sandboxes (rare); treat as off */
    return false;
  }
}

/** One-shot diagnostic log. Emits unconditionally for the first N calls so
 *  a fresh reload reveals the full state of each feature, then falls silent
 *  unless the user has flipped `localStorage.witnessedDebug = '1'`. */
function explain(...args: unknown[]): void {
  if (explained >= EXPLAIN_FIRST_N && !debugEnabled()) return;
  explained += 1;
  console.info(LOG_PREFIX, ...args);
}

function warn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

/** Logged once, unconditionally — lets the user confirm the new build is live
 *  without needing to flip a localStorage debug flag. */
function info(...args: unknown[]): void {
  console.info(LOG_PREFIX, ...args);
}

// ── Write side ────────────────────────────────────────────────
// Auto-BCC seal@ into every new compose. Ported from v0.1 intact —
// nothing changed here beyond module shape.

function findUnprocessedComposes(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>(
    `div[role="dialog"]:not([${COMPOSE_PROCESSED}])`,
  );
  const result: HTMLElement[] = [];
  for (const dialog of dialogs) {
    if (dialog.querySelector('input[name="subjectbox"], textarea[name="subjectbox"]')) {
      result.push(dialog);
    }
  }
  return result;
}

function expandBccRow(dialog: HTMLElement): void {
  if (findBccInput(dialog)) return;

  // Pass 1: any clickable-looking element whose label or visible text is
  // a "bcc"-looking affordance. Gmail has shipped each of these variants
  // at different times: plain span with textContent "Bcc", a role=link
  // span with aria-label "Add Bcc recipients", a span with aria-label
  // "Bcc" plus a localised tooltip, and the compact "Bcc" button in the
  // new Workspace compose header.
  const candidates = dialog.querySelectorAll<HTMLElement>(
    '[role="link"], [role="button"], span, button',
  );
  for (const candidate of candidates) {
    const aria = (candidate.getAttribute("aria-label") ?? "").trim().toLowerCase();
    const text = (candidate.textContent ?? "").trim().toLowerCase();
    const matchesAria =
      /^(add\s+)?bcc\b/.test(aria) || aria === "bcc" || aria.includes("bcc recipients");
    const matchesText = text === "bcc";
    if (!(matchesAria || matchesText)) continue;
    // Guard: make sure we don't misclick the "Bcc" label on the expanded
    // row itself (some Gmail builds keep a clickable label there too).
    const inExpandedRow = candidate.closest('tr[role="presentation"]')?.querySelector(
      'input[aria-label^="Bcc" i], textarea[aria-label^="Bcc" i]',
    );
    if (inExpandedRow) continue;
    explain("compose: clicked Bcc trigger", {
      aria: aria || null,
      text: text || null,
      tag: candidate.tagName.toLowerCase(),
    });
    candidate.click();
    return;
  }

  // Pass 2: keyboard-shortcut fallback. Gmail's default shortcut for the
  // Bcc field is Cmd/Ctrl+Shift+B, but it only fires if the user has
  // enabled keyboard shortcuts. It's a cheap attempt — if it doesn't work
  // the observer will keep retrying as the user types.
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
  explain("compose: no Bcc trigger matched any selector — will retry");
}

function findBccInput(dialog: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  return dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input[aria-label^="Bcc" i], textarea[aria-label^="Bcc" i], input[name="bcc"], textarea[name="bcc"]',
  );
}

function sealAlreadyAdded(dialog: HTMLElement): boolean {
  const bccRow = dialog.querySelector<HTMLElement>('[aria-label*="Bcc" i]')?.closest("tr, div");
  const scope = bccRow ?? dialog;
  return scope.textContent?.includes(SEAL_ADDRESS) ?? false;
}

function insertSealChip(input: HTMLInputElement | HTMLTextAreaElement): void {
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
  if (!input) {
    explain("compose: Bcc field not yet visible, will retry on next mutation");
    return false;
  }

  if (sealAlreadyAdded(dialog)) {
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    explain("compose: seal address already present, marked processed");
    return true;
  }

  try {
    insertSealChip(input);
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    void bumpInjectedCount();
    explain("compose: seal injected", { address: SEAL_ADDRESS });
    return true;
  } catch (err) {
    warn("insert failed", err);
    return false;
  }
}

function scanComposes(): void {
  for (const dialog of findUnprocessedComposes()) processCompose(dialog);
}

// ── Read side ─────────────────────────────────────────────────
// Every inbox row in Gmail has a sender cell exposing the sender's
// email via `span[email="..."]` — Gmail's own stable attribute for
// display-name resolution. We extract the domain, look up state from
// the site's public endpoint (cached in chrome.storage.local), and
// append a small colored pill to the sender cell.

function emailToDomain(raw: string | null | undefined): string | null {
  const addr = raw?.trim().toLowerCase();
  if (!addr || !addr.includes("@")) return null;
  const domain = addr.split("@", 2)[1];
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

function extractSenderDomain(row: HTMLElement): string | null {
  // Gmail reshuffles the list-view DOM every few quarters. We try the most
  // reliable stable markers first, then fall back to newer hovercard
  // attributes, then (last resort) scrape any visible string that looks
  // like an email. Each selector returns fast if Gmail hasn't migrated.

  // 1) `span[email]` — the classic, present for years across densities.
  const span = row.querySelector<HTMLElement>("span[email]");
  const fromEmailAttr = emailToDomain(span?.getAttribute("email"));
  if (fromEmailAttr) return fromEmailAttr;

  // 2) Newer hovercard attributes. `data-hovercard-id` often holds an
  //    email; sometimes it's a person ID, so we only accept it if it
  //    parses cleanly as `local@domain`.
  for (const attr of ["data-hovercard-id", "data-hovercard-owner-id"]) {
    const el = row.querySelector<HTMLElement>(`[${attr}]`);
    const v = emailToDomain(el?.getAttribute(attr));
    if (v) return v;
  }

  // 3) Last resort: regex-scan the innerText of the sender cell. This is
  //    slow and fragile, so it's only done when the structured attrs are
  //    missing entirely.
  const cell =
    row.querySelector<HTMLElement>("td.yX") ??
    row.querySelector<HTMLElement>('[role="gridcell"]');
  const match = cell?.innerText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  if (match) return emailToDomain(match[0]);

  return null;
}

function findPillAnchor(row: HTMLElement): HTMLElement | null {
  // We want the pill to land immediately before the sender name. Gmail's
  // sender cell is a nested flexbox; inserting into its first meaningful
  // child survives the frequent re-renders Gmail does on hover.
  const senderCell =
    row.querySelector<HTMLElement>("td.yX") ??
    row.querySelector<HTMLElement>('[role="gridcell"]') ??
    row;
  const nameSpan =
    senderCell.querySelector<HTMLElement>("span[email]") ??
    senderCell.querySelector<HTMLElement>(".yW span");
  return nameSpan?.parentElement ?? senderCell;
}

async function decorateRow(row: HTMLElement): Promise<void> {
  if (!statusEnabled) return;
  if (row.getAttribute(ROW_PROCESSED_ATTR)) return;

  const domain = extractSenderDomain(row);
  if (!domain) {
    explain("row skipped — could not extract sender domain", {
      rowPreview: row.innerText.slice(0, 80),
    });
    return;
  }

  row.setAttribute(ROW_PROCESSED_ATTR, domain);

  try {
    const payload = await lookupDomain(domain);
    if (!row.isConnected) {
      explain("row detached before pill render", { domain });
      return;
    }
    if (row.querySelector(`.${PILL_CLASS_NAME}`)) {
      explain("pill already present, skipping", { domain });
      return;
    }
    const pill = buildPill(payload);
    if (!pill) {
      explain("buildPill returned null (error state)", {
        domain,
        state: payload.state,
      });
      return;
    }
    const anchor = findPillAnchor(row);
    if (!anchor) {
      explain("no anchor found for pill", { domain });
      return;
    }
    anchor.insertBefore(pill, anchor.firstChild);
    explain("pill inserted", {
      domain,
      state: payload.state,
      trust: payload.trustIndex,
    });
  } catch (err) {
    explain("lookup threw", { domain, err: String(err) });
  }
}

function scanInboxRows(): void {
  if (!statusEnabled) return;
  const rows = document.querySelectorAll<HTMLElement>(
    `tr.zA:not([${ROW_PROCESSED_ATTR}])`,
  );
  // First time we actually see rows, emit a visible confirmation so the
  // user can tell the content script is wired up and the inbox is being
  // scanned. We don't log on empty scans (too noisy: Gmail mutates a lot
  // before the inbox renders). A one-shot latch keeps the console tidy.
  if (!firstScanLogged && rows.length > 0) {
    firstScanLogged = true;
    info("inbox scan live", { rows: rows.length, build: BUILD_TAG });
  }
  for (const row of rows) void decorateRow(row);
}

/** Remove every rendered pill from the page — wired to the popup toggle. */
function stripAllPills(): void {
  for (const pill of document.querySelectorAll(`.${PILL_CLASS_NAME}`)) {
    pill.remove();
  }
  for (const row of document.querySelectorAll(`[${ROW_PROCESSED_ATTR}]`)) {
    row.removeAttribute(ROW_PROCESSED_ATTR);
  }
}

// ── Observer / bootstrap ──────────────────────────────────────

let composePending = false;
let inboxPending = false;

function scheduleComposeScan(): void {
  if (composePending) return;
  composePending = true;
  setTimeout(() => {
    composePending = false;
    scanComposes();
  }, COMPOSE_DEBOUNCE_MS);
}

function scheduleInboxScan(): void {
  if (inboxPending) return;
  inboxPending = true;
  setTimeout(() => {
    inboxPending = false;
    scanInboxRows();
  }, INBOX_DEBOUNCE_MS);
}

async function boot(): Promise<void> {
  const settings = await getSettings();
  injectEnabled = settings.enabled;
  statusEnabled = settings.showStatus;
  ensureStylesheet();

  info(`${BUILD_TAG} booted`, {
    inject: injectEnabled,
    status: statusEnabled,
    href: location.pathname + location.hash,
  });

  onSettingsChange((next) => {
    if (typeof next.enabled === "boolean") injectEnabled = next.enabled;
    if (typeof next.showStatus === "boolean") {
      const was = statusEnabled;
      statusEnabled = next.showStatus;
      if (was && !statusEnabled) stripAllPills();
      if (!was && statusEnabled) scheduleInboxScan();
    }
  });

  const observer = new MutationObserver(() => {
    scheduleComposeScan();
    scheduleInboxScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleComposeScan();
  scheduleInboxScan();

  // Gmail's inbox list is rendered asynchronously after document_idle.
  // A handful of one-off retries in the first ~10s catches the case where
  // the user lands directly on /mail/u/0/#inbox and there are no further
  // mutations to fire the observer before rows appear.
  const kickoffs = [500, 1200, 2500, 5000, 10000];
  for (const ms of kickoffs) {
    setTimeout(() => scheduleInboxScan(), ms);
  }
}

boot().catch((err) => warn("boot failed", err));
