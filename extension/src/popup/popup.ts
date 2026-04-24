import { SEAL_ADDRESS, WITNESSED_HOME } from "../lib/constants";
import {
  getSettings,
  onSettingsChange,
  setEnabled,
  setTheme,
  type ThemePref,
} from "../lib/storage";
import { lookupDomain } from "../lib/api";
import type { DomainState, PublicPayload } from "../lib/types";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// ── State chip palette ────────────────────────────────────────
// Traffic-light semantics — mirrors `globals.css` and the seal
// page so the popup, the badge, and /b/<domain> all read as the
// same product.
//   verified  → green
//   onRecord  → amber
//   pending   → yellow
//   unclaimed → neutral gray
//   error     → red
const CHIP: Record<
  DomainState,
  { label: string; hint: string; dot: string; border: string; tint: string }
> = {
  verified: {
    label: "Verified",
    hint: "Trusted — meets the verified bar",
    dot: "#22c55e",
    border: "rgba(34,197,94,0.40)",
    tint: "rgba(34,197,94,0.09)",
  },
  onRecord: {
    label: "Building",
    hint: "Sealing outbound mail; building reputation",
    dot: "#f59e0b",
    border: "rgba(245,158,11,0.40)",
    tint: "rgba(245,158,11,0.08)",
  },
  pending: {
    label: "Pending",
    hint: "First seal only — not warmed up yet",
    dot: "#eab308",
    border: "rgba(234,179,8,0.40)",
    tint: "rgba(234,179,8,0.09)",
  },
  unclaimed: {
    label: "Unclaimed",
    hint: "No sealed outbound mail from this domain yet",
    dot: "#9ca3af",
    border: "rgba(156,163,175,0.40)",
    tint: "rgba(156,163,175,0.08)",
  },
  error: {
    label: "Unavailable",
    hint: "Couldn't reach witnessed.cc — try again in a moment",
    dot: "#ef4444",
    border: "rgba(239,68,68,0.40)",
    tint: "rgba(239,68,68,0.09)",
  },
};

const MAX_ITEMS = 25;

const toggleInject = $<HTMLInputElement>("toggle-inject");
const sealAddr = $<HTMLElement>("seal-addr");

const sendersTitle = $<HTMLElement>("senders-title");
const sendersSub = $<HTMLElement>("senders-sub");
const sendersEmpty = $<HTMLElement>("senders-empty");
const sendersList = $<HTMLUListElement>("senders-list");
const sendersMore = $<HTMLElement>("senders-more");
const themeBtn = $<HTMLButtonElement>("theme-toggle");

// ── Theme ─────────────────────────────────────────────────────
// Resolution order: explicit user choice → prefers-color-scheme → dark.
// Toggling from "auto" (null) flips to the OPPOSITE of what's currently
// visible, so the user's first click always produces a visible change.

type ActiveTheme = "dark" | "light";

const SUN_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;

const MOON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

function systemTheme(): ActiveTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolveTheme(pref: ThemePref): ActiveTheme {
  return pref ?? systemTheme();
}

function applyTheme(theme: ActiveTheme): void {
  const html = document.documentElement;
  html.classList.toggle("light", theme === "light");
  html.classList.toggle("dark", theme === "dark");
  // Button shows the icon of the theme the user would be switching TO
  // on click — same UX as the site's ThemeToggle.
  themeBtn.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
  // Mirror the active theme into localStorage so the inline bootstrap
  // script in popup.html can apply it synchronously on the next open,
  // avoiding a flash of the wrong theme.
  try {
    localStorage.setItem("witnessedTheme", theme);
  } catch {
    /* non-fatal — just means the next open may briefly flash */
  }
}

// ── Senders list rendering ────────────────────────────────────

type VisibleContext = "thread" | "list" | "none" | "not-gmail" | "no-content";

interface VisibleDomainEntry {
  domain: string;
  source: "thread" | "row";
}

interface VisibleDomainsReply {
  domains: VisibleDomainEntry[];
  context: "thread" | "list" | "none";
}

interface LocalReply {
  domains: VisibleDomainEntry[];
  context: VisibleContext;
}

function contextCopy(ctx: VisibleContext, count: number): {
  title: string;
  sub: string;
} {
  if (ctx === "thread") {
    return {
      title: count === 1 ? "Sender in this chat" : "Senders in this chat",
      sub: count === 1 ? "1 domain" : `${count} domains`,
    };
  }
  if (ctx === "list") {
    return {
      title: "Senders in view",
      sub: count === 1 ? "1 domain in your inbox list" : `${count} domains in your inbox list`,
    };
  }
  if (ctx === "not-gmail") {
    return {
      title: "Not a Gmail tab",
      sub: "Switch to a Gmail tab and reopen this popup.",
    };
  }
  if (ctx === "no-content") {
    return {
      title: "Gmail not ready yet",
      sub: "Reload the Gmail tab and reopen this popup.",
    };
  }
  return { title: "No senders in view", sub: " " };
}

function setEmpty(ctx: VisibleContext): void {
  sendersList.hidden = true;
  sendersList.innerHTML = "";
  sendersMore.hidden = true;
  const { title, sub } = contextCopy(ctx, 0);
  sendersTitle.textContent = title;
  sendersSub.textContent = sub;
  sendersEmpty.hidden = false;
  // Switch empty copy based on context
  const sub1 = sendersEmpty.querySelector<HTMLElement>(
    ".senders-empty-sub",
  );
  const title1 = sendersEmpty.querySelector<HTMLElement>(
    ".senders-empty-title",
  );
  if (title1) title1.textContent = title;
  if (sub1) sub1.textContent = sub;
}

function createItem(entry: VisibleDomainEntry): HTMLLIElement {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "sender-item loading";
  a.href = `${WITNESSED_HOME}/b/${encodeURIComponent(entry.domain)}`;
  a.target = "_blank";
  a.rel = "noopener";

  const main = document.createElement("div");
  main.className = "sender-main";

  const dom = document.createElement("div");
  dom.className = "sender-domain";
  dom.textContent = entry.domain;

  const meta = document.createElement("div");
  meta.className = "sender-meta";
  const source = document.createElement("span");
  source.textContent = entry.source === "thread" ? "in chat" : "inbox row";
  const sep = document.createElement("span");
  sep.className = "sep";
  const trust = document.createElement("span");
  trust.className = "sender-trust";
  trust.textContent = "—";
  trust.dataset.field = "trust";
  meta.append(source, sep, trust);

  main.append(dom, meta);

  const state = document.createElement("span");
  state.className = "sender-state";
  state.dataset.field = "state";
  const dot = document.createElement("span");
  dot.className = "state-dot";
  const label = document.createElement("span");
  label.textContent = "checking…";
  state.append(dot, label);

  a.append(main, state);
  li.appendChild(a);
  return li;
}

function paintItem(li: HTMLLIElement, payload: PublicPayload): void {
  const a = li.querySelector<HTMLAnchorElement>(".sender-item");
  if (!a) return;
  a.classList.remove("loading");

  const chip = CHIP[payload.state];
  const state = li.querySelector<HTMLElement>('[data-field="state"]');
  if (state) {
    state.style.borderColor = chip.border;
    state.style.backgroundColor = chip.tint;
    state.title = chip.hint;
    const dot = state.querySelector<HTMLElement>(".state-dot");
    if (dot) dot.style.background = chip.dot;
    const label = state.querySelector<HTMLElement>("span:not(.state-dot)");
    if (label) label.textContent = chip.label;
  }

  const trust = li.querySelector<HTMLElement>('[data-field="trust"]');
  if (trust) {
    const ti = payload.trustIndex;
    trust.textContent = ti == null ? "—" : `${ti}/100`;
  }
}

async function queryVisibleDomains(): Promise<LocalReply> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
    return { domains: [], context: "not-gmail" };
  }
  try {
    const reply = (await chrome.tabs.sendMessage(tab.id, {
      kind: "GET_VISIBLE_DOMAINS",
    })) as VisibleDomainsReply | undefined;
    if (!reply) return { domains: [], context: "no-content" };
    return reply;
  } catch (err) {
    // Content script not injected yet (cold Gmail tab, or Gmail under a
    // different URL variant).
    console.warn("[witnessed] visible-domains query failed", err);
    return { domains: [], context: "no-content" };
  }
}

async function renderSenders(): Promise<void> {
  const { domains, context } = await queryVisibleDomains();

  if (domains.length === 0) {
    setEmpty(context);
    return;
  }

  sendersEmpty.hidden = true;
  sendersList.hidden = false;
  sendersList.innerHTML = "";

  const visible = domains.slice(0, MAX_ITEMS);
  const { title, sub } = contextCopy(context, domains.length);
  sendersTitle.textContent = title;
  sendersSub.textContent = sub;

  // Build rows + render immediately in loading state so the popup
  // paints without waiting on the network.
  const items = visible.map((entry) => ({
    entry,
    node: createItem(entry),
  }));
  for (const item of items) sendersList.appendChild(item.node);

  if (domains.length > visible.length) {
    sendersMore.hidden = false;
    sendersMore.textContent = `+ ${domains.length - visible.length} more not shown`;
  } else {
    sendersMore.hidden = true;
  }

  // Kick off lookups in parallel. lookupDomain is cache-aware and
  // dedups in-flight requests, so a busy inbox doesn't fan out.
  await Promise.all(
    items.map(async ({ entry, node }) => {
      try {
        const payload = await lookupDomain(entry.domain);
        paintItem(node, payload);
      } catch (err) {
        console.warn("[witnessed] lookup failed", entry.domain, err);
        paintItem(node, {
          domain: entry.domain,
          state: "error",
          trustIndex: null,
          verifiedEventCount: 0,
          mutualCounterparties: 0,
          uniqueReceivers: 0,
          inboundCount: null,
          firstSeen: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }),
  );
}

async function main(): Promise<void> {
  sealAddr.textContent = SEAL_ADDRESS;

  const initial = await getSettings();
  toggleInject.checked = initial.enabled;

  // Apply the stored theme immediately, and keep tracking the system
  // theme for users who've never set an explicit preference.
  let themePref: ThemePref = initial.theme;
  applyTheme(resolveTheme(themePref));

  const osQuery = window.matchMedia("(prefers-color-scheme: light)");
  osQuery.addEventListener?.("change", () => {
    if (themePref === null) applyTheme(resolveTheme(null));
  });

  themeBtn.addEventListener("click", () => {
    const nowVisible = resolveTheme(themePref);
    const next: ActiveTheme = nowVisible === "dark" ? "light" : "dark";
    themePref = next;
    void setTheme(next);
    applyTheme(next);
  });

  toggleInject.addEventListener("change", () => {
    void setEnabled(toggleInject.checked);
  });

  onSettingsChange((next) => {
    if (typeof next.enabled === "boolean") {
      toggleInject.checked = next.enabled;
    }
    if ("theme" in next) {
      themePref = next.theme ?? null;
      applyTheme(resolveTheme(themePref));
    }
  });

  await renderSenders();
}

void main();
