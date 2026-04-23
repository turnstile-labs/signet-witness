import {
  SEAL_ADDRESS,
  SETUP_URL,
  WITNESSED_HOME,
} from "../lib/constants";
import {
  getSettings,
  onSettingsChange,
  setEnabled,
} from "../lib/storage";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const toggle = $<HTMLInputElement>("toggle");
const count = $<HTMLElement>("count");
const tips = $<HTMLElement>("tips");
const sealAddr = $<HTMLElement>("seal-addr");
const home = $<HTMLAnchorElement>("home");
const setup = $<HTMLAnchorElement>("setup");

function render(enabled: boolean, injected: number): void {
  toggle.checked = enabled;
  count.textContent = String(injected);
  if (enabled) {
    tips.classList.remove("off");
    tips.innerHTML = `Open Gmail. Every new compose gets <code>${SEAL_ADDRESS}</code> in Bcc. Remove it on any individual email you don't want recorded.`;
  } else {
    tips.classList.add("off");
    tips.textContent = "Sealing is paused. Toggle it back on to resume.";
  }
}

async function main(): Promise<void> {
  sealAddr.textContent = SEAL_ADDRESS;
  home.href = WITNESSED_HOME;
  setup.href = SETUP_URL;

  const initial = await getSettings();
  render(initial.enabled, initial.injectedCount);

  toggle.addEventListener("change", () => {
    void setEnabled(toggle.checked);
  });

  onSettingsChange(async (next) => {
    const current = await getSettings();
    render(
      next.enabled ?? current.enabled,
      next.injectedCount ?? current.injectedCount,
    );
  });
}

void main();
