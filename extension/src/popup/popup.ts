import {
  SEAL_ADDRESS,
  SETUP_URL,
  WITNESSED_HOME,
} from "../lib/constants";
import {
  getSettings,
  onSettingsChange,
  setEnabled,
  setShowStatus,
} from "../lib/storage";
import { clearCache } from "../lib/cache";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const toggleInject = $<HTMLInputElement>("toggle-inject");
const toggleStatus = $<HTMLInputElement>("toggle-status");
const count = $<HTMLElement>("count");
const sealAddr = $<HTMLElement>("seal-addr");
const home = $<HTMLAnchorElement>("home");
const setup = $<HTMLAnchorElement>("setup");
const clearBtn = $<HTMLButtonElement>("clear-cache");

function render(
  injectOn: boolean,
  statusOn: boolean,
  injected: number,
): void {
  toggleInject.checked = injectOn;
  toggleStatus.checked = statusOn;
  count.textContent = String(injected);
}

async function main(): Promise<void> {
  sealAddr.textContent = SEAL_ADDRESS;
  home.href = WITNESSED_HOME;
  setup.href = SETUP_URL;

  const initial = await getSettings();
  render(initial.enabled, initial.showStatus, initial.injectedCount);

  toggleInject.addEventListener("change", () => {
    void setEnabled(toggleInject.checked);
  });
  toggleStatus.addEventListener("change", () => {
    void setShowStatus(toggleStatus.checked);
  });

  clearBtn.addEventListener("click", async () => {
    clearBtn.disabled = true;
    const label = clearBtn.textContent ?? "Refresh lookups";
    try {
      await clearCache();
      clearBtn.textContent = "Cleared";
      clearBtn.classList.add("done");
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
    render(
      next.enabled ?? current.enabled,
      next.showStatus ?? current.showStatus,
      next.injectedCount ?? current.injectedCount,
    );
  });
}

void main();
