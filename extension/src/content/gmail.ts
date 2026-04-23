/**
 * Gmail content script: watches for new compose dialogs and injects
 * seal@witnessed.cc into the Bcc field. Runs only on mail.google.com.
 *
 * Strategy:
 *   1. MutationObserver on document.body picks up compose dialogs as they
 *      appear (both popup compose and fullscreen compose use role=dialog).
 *   2. For each unprocessed dialog, expand the Bcc row if collapsed, then
 *      insert the seal address via execCommand('insertText') so Gmail's
 *      internal Closure state sees a real keystroke and creates a chip.
 *   3. Mark the dialog with data-witnessed-processed so removing the chip
 *      manually on a given compose sticks — we never re-inject on a dialog
 *      we've already handled.
 *
 * Everything is defensive: Gmail ships DOM tweaks often, so every selector
 * has a fallback and every failure is swallowed with a console.debug so the
 * user's mail flow is never interrupted.
 */

import { SEAL_ADDRESS, COMPOSE_DEBOUNCE_MS } from "../lib/constants";
import { bumpInjectedCount, getSettings, onSettingsChange } from "../lib/storage";

const PROCESSED_ATTR = "data-witnessed-processed";
const LOG_PREFIX = "[witnessed]";

let enabled = true;

/** Cheap log — silent by default, flip via `localStorage.witnessedDebug=1`. */
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

/**
 * Return all Gmail compose dialogs currently in the DOM that we haven't yet
 * attempted to process. A compose dialog is a role=dialog that contains the
 * subject input (Gmail's stable anchor across UI refreshes).
 */
function findUnprocessedComposes(): HTMLElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>(
    'div[role="dialog"]:not([' + PROCESSED_ATTR + '])',
  );
  const result: HTMLElement[] = [];
  for (const dialog of dialogs) {
    if (dialog.querySelector('input[name="subjectbox"], textarea[name="subjectbox"]')) {
      result.push(dialog);
    }
  }
  return result;
}

/**
 * Expand the Bcc row if Gmail is hiding it. Gmail uses different markup in
 * popup vs fullscreen compose, so we try several selectors and click the
 * first trigger that looks right.
 */
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
  const bccRow = dialog.querySelector<HTMLElement>(
    '[aria-label*="Bcc" i]',
  )?.closest("tr, div");
  const scope = bccRow ?? dialog;
  return scope.textContent?.includes(SEAL_ADDRESS) ?? false;
}

/**
 * Push the seal address into the Bcc field and commit it as a chip.
 * execCommand is deprecated per spec but remains the only reliable way to
 * fire a synthetic keystroke through Gmail's contenteditable/chip pipeline.
 */
function insertSealChip(input: HTMLInputElement | HTMLTextAreaElement): boolean {
  input.focus();
  const ok = document.execCommand("insertText", false, SEAL_ADDRESS);
  if (!ok) {
    input.value = SEAL_ADDRESS;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const commit = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
  });
  input.dispatchEvent(commit);
  input.blur();
  return true;
}

/**
 * Process a single compose dialog. Idempotent via the PROCESSED_ATTR marker.
 * Returns true if we successfully injected, false if we need to retry on a
 * later mutation (e.g. Bcc field not yet rendered).
 */
function processCompose(dialog: HTMLElement): boolean {
  if (!enabled) return true;
  if (dialog.hasAttribute(PROCESSED_ATTR)) return true;

  expandBccRow(dialog);
  const input = findBccInput(dialog);
  if (!input) return false;

  if (sealAlreadyAdded(dialog)) {
    dialog.setAttribute(PROCESSED_ATTR, "1");
    return true;
  }

  try {
    insertSealChip(input);
    dialog.setAttribute(PROCESSED_ATTR, "1");
    void bumpInjectedCount();
    debug("sealed compose", dialog);
    return true;
  } catch (err) {
    warn("insert failed", err);
    return false;
  }
}

function scanAndProcess(): void {
  const composes = findUnprocessedComposes();
  for (const dialog of composes) {
    processCompose(dialog);
  }
}

/** Coalesce mutation bursts — Gmail fires hundreds during compose animations. */
let pending = false;
function scheduleScan(): void {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    scanAndProcess();
  }, COMPOSE_DEBOUNCE_MS);
}

async function boot(): Promise<void> {
  const settings = await getSettings();
  enabled = settings.enabled;

  onSettingsChange((next) => {
    if (typeof next.enabled === "boolean") enabled = next.enabled;
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleScan();
  debug("content script booted; enabled =", enabled);
}

boot().catch((err) => warn("boot failed", err));
