import {
  SEAL_ADDRESS,
  SETUP_URL,
  WITNESSED_HOME,
} from "../lib/constants";
import { getSettings, onSettingsChange, setEnabled } from "../lib/storage";
import { clearCache } from "../lib/cache";
import { lookupDomain } from "../lib/api";
import type { DomainState, PublicPayload } from "../lib/types";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// ── State chip palette ────────────────────────────────────────
// Mirrors the colours used on /b/<domain> so the popup reads as the
// same product.
const CHIP: Record<
  DomainState,
  { label: string; hint: string; dot: string; border: string; tint: string }
> = {
  verified: {
    label: "Verified",
    hint: "Trusted — meets the verified bar",
    dot: "#22c55e",
    border: "rgba(34,197,94,0.4)",
    tint: "rgba(34,197,94,0.09)",
  },
  onRecord: {
    label: "On record",
    hint: "Sealing outbound mail; building reputation",
    dot: "#f59e0b",
    border: "rgba(245,158,11,0.4)",
    tint: "rgba(245,158,11,0.08)",
  },
  pending: {
    label: "Pending",
    hint: "First seal only — not warmed up yet",
    dot: "#7c6af7",
    border: "rgba(124,106,247,0.4)",
    tint: "rgba(124,106,247,0.09)",
  },
  unclaimed: {
    label: "Unclaimed",
    hint: "No sealed outbound mail from this domain yet",
    dot: "#9ca3af",
    border: "rgba(156,163,175,0.4)",
    tint: "rgba(156,163,175,0.09)",
  },
  error: {
    label: "Unavailable",
    hint: "Couldn't reach witnessed.cc — try Refresh",
    dot: "#ef4444",
    border: "rgba(239,68,68,0.4)",
    tint: "rgba(239,68,68,0.09)",
  },
};

const toggleInject = $<HTMLInputElement>("toggle-inject");
const count = $<HTMLElement>("count");
const sealAddr = $<HTMLElement>("seal-addr");
const home = $<HTMLAnchorElement>("home");
const setup = $<HTMLAnchorElement>("setup");
const clearBtn = $<HTMLButtonElement>("clear-cache");

const senderCard = $<HTMLElement>("sender-card");
const senderEmpty = $<HTMLElement>("sender-empty");
const senderLoading = $<HTMLElement>("sender-loading");
const senderLoadingDomain = $<HTMLElement>("sender-loading-domain");
const senderDomain = $<HTMLElement>("sender-domain");
const senderSource = $<HTMLElement>("sender-source");
const senderCta = $<HTMLAnchorElement>("sender-cta");
const stateChip = $<HTMLElement>("state-chip");
const stateDot = $<HTMLElement>("state-dot");
const stateLabel = $<HTMLElement>("state-label");
const trust = $<HTMLElement>("trust");
const trustValue = $<HTMLElement>("trust-value");
const trustFill = $<HTMLElement>("trust-fill");
const statEvents = $<HTMLElement>("stat-events");
const statMutual = $<HTMLElement>("stat-mutual");
const statReceivers = $<HTMLElement>("stat-receivers");

function setSenderView(view: "empty" | "loading" | "card"): void {
  senderEmpty.hidden = view !== "empty";
  senderLoading.hidden = view !== "loading";
  senderCard.hidden = view !== "card";
}

function renderSenderCard(payload: PublicPayload, source: string): void {
  const chip = CHIP[payload.state];
  senderDomain.textContent = payload.domain;
  senderSource.textContent =
    source === "thread"
      ? "from the open conversation"
      : source === "row"
        ? "from the selected row"
        : "";

  stateLabel.textContent = chip.label;
  stateDot.style.background = chip.dot;
  stateChip.style.borderColor = chip.border;
  stateChip.style.backgroundColor = chip.tint;
  stateChip.title = chip.hint;

  const ti = payload.trustIndex;
  if (ti === null) {
    trust.style.display = "none";
  } else {
    trust.style.display = "";
    trustValue.textContent = `${ti} / 100`;
    trustFill.style.width = `${Math.max(2, Math.min(100, ti))}%`;
    trustFill.style.background = chip.dot;
  }

  statEvents.textContent = String(payload.verifiedEventCount ?? 0);
  statMutual.textContent = String(payload.mutualCounterparties ?? 0);
  statReceivers.textContent = String(payload.uniqueReceivers ?? 0);

  senderCta.href = `${WITNESSED_HOME}/b/${encodeURIComponent(payload.domain)}`;

  setSenderView("card");
}

interface FocusReply {
  domain: string | null;
  source: string;
}

async function queryFocusDomain(): Promise<FocusReply> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
    return { domain: null, source: "not-gmail" };
  }
  try {
    const reply = (await chrome.tabs.sendMessage(tab.id, {
      kind: "GET_FOCUS_DOMAIN",
    })) as FocusReply | undefined;
    return reply ?? { domain: null, source: "none" };
  } catch (err) {
    // Content script not injected yet (cold Gmail tab, or Gmail under a
    // different URL variant). We treat this the same as "no focus".
    console.warn("[witnessed] focus query failed", err);
    return { domain: null, source: "no-content" };
  }
}

async function refreshSender(): Promise<void> {
  const { domain, source } = await queryFocusDomain();
  if (!domain) {
    setSenderView("empty");
    return;
  }
  senderLoadingDomain.textContent = domain;
  setSenderView("loading");
  try {
    const payload = await lookupDomain(domain);
    renderSenderCard(payload, source);
  } catch (err) {
    console.warn("[witnessed] lookup failed", err);
    renderSenderCard(
      {
        domain,
        state: "error",
        trustIndex: null,
        verifiedEventCount: 0,
        mutualCounterparties: 0,
        uniqueReceivers: 0,
        inboundCount: null,
        firstSeen: null,
        updatedAt: new Date().toISOString(),
      },
      source,
    );
  }
}

async function main(): Promise<void> {
  sealAddr.textContent = SEAL_ADDRESS;
  home.href = WITNESSED_HOME;
  setup.href = SETUP_URL;

  const initial = await getSettings();
  toggleInject.checked = initial.enabled;
  count.textContent = String(initial.injectedCount);

  toggleInject.addEventListener("change", () => {
    void setEnabled(toggleInject.checked);
  });

  clearBtn.addEventListener("click", async () => {
    clearBtn.disabled = true;
    const label = clearBtn.textContent ?? "Refresh";
    try {
      await clearCache();
      clearBtn.textContent = "Cleared";
      clearBtn.classList.add("done");
      await refreshSender();
      setTimeout(() => {
        clearBtn.textContent = label;
        clearBtn.classList.remove("done");
        clearBtn.disabled = false;
      }, 1100);
    } catch (err) {
      console.warn("[witnessed] clear failed", err);
      clearBtn.disabled = false;
    }
  });

  onSettingsChange(async (next) => {
    const current = await getSettings();
    toggleInject.checked = next.enabled ?? current.enabled;
    count.textContent = String(next.injectedCount ?? current.injectedCount);
  });

  await refreshSender();
}

void main();
