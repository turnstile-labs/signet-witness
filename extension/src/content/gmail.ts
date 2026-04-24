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
const BUILD_TAG = "v0.2.1";

let injectEnabled = true;
let statusEnabled = true;
let firstScanLogged = false;

function debug(...args: unknown[]): void {
  try {
    if (localStorage.getItem("witnessedDebug") === "1") {
      console.log(LOG_PREFIX, ...args);
    }
  } catch {
    /* localStorage blocked in some sandboxes; fine */
  }
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
  const alreadyVisible = dialog.querySelector<HTMLElement>(
    'input[aria-label^="Bcc" i], textarea[aria-label^="Bcc" i], [name="bcc"]',
  );
  if (alreadyVisible) return;

  const triggerSelectors = [
    'span[aria-label*="Bcc" i]',
    'button[aria-label*="Bcc" i]',
    'span[role="link"]',
  ];
  for (const sel of triggerSelectors) {
    const candidates = dialog.querySelectorAll<HTMLElement>(sel);
    for (const candidate of candidates) {
      const label = (candidate.getAttribute("aria-label") ?? candidate.textContent ?? "")
        .trim()
        .toLowerCase();
      if (label === "bcc" || label.startsWith("add bcc")) {
        candidate.click();
        return;
      }
    }
  }
  debug("no Bcc trigger found; will retry on next mutation");
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
  if (!input) return false;

  if (sealAlreadyAdded(dialog)) {
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    return true;
  }

  try {
    insertSealChip(input);
    dialog.setAttribute(COMPOSE_PROCESSED, "1");
    void bumpInjectedCount();
    debug("sealed compose", dialog);
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
  if (!domain) return;

  row.setAttribute(ROW_PROCESSED_ATTR, domain);

  try {
    const payload = await lookupDomain(domain);
    // Row may have been re-rendered/removed between request and response.
    // Guard against re-append into a detached node, and against stacking
    // duplicate pills if Gmail resurrected the row.
    if (!row.isConnected) return;
    if (row.querySelector(`.${PILL_CLASS_NAME}`)) return;
    const pill = buildPill(payload);
    if (!pill) return;
    const anchor = findPillAnchor(row);
    anchor?.insertBefore(pill, anchor.firstChild);
  } catch (err) {
    debug("lookup failed", domain, err);
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
