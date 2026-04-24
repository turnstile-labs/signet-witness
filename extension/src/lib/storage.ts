import { STORAGE_KEYS } from "./constants";

export interface Settings {
  /** BCC injection on outbound compose windows. */
  enabled: boolean;
  injectedCount: number;
}

const DEFAULTS: Settings = {
  enabled: true,
  injectedCount: 0,
};

/**
 * Read user settings from chrome.storage.sync, falling back to safe defaults
 * when the extension runs before the background worker has seeded storage
 * (first install, profile sync lag, etc.).
 */
export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.sync.get([
    STORAGE_KEYS.enabled,
    STORAGE_KEYS.injected,
  ]);
  return {
    enabled:
      typeof raw[STORAGE_KEYS.enabled] === "boolean"
        ? (raw[STORAGE_KEYS.enabled] as boolean)
        : DEFAULTS.enabled,
    injectedCount:
      typeof raw[STORAGE_KEYS.injected] === "number"
        ? (raw[STORAGE_KEYS.injected] as number)
        : DEFAULTS.injectedCount,
  };
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.enabled]: enabled });
}

export async function bumpInjectedCount(): Promise<void> {
  const { injectedCount } = await getSettings();
  await chrome.storage.sync.set({
    [STORAGE_KEYS.injected]: injectedCount + 1,
  });
}

/**
 * Subscribe to live changes so the popup can render in sync with the content
 * script (e.g. injected-count ticks up while the popup is open).
 */
export function onSettingsChange(
  handler: (next: Partial<Settings>) => void,
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "sync") return;
    const next: Partial<Settings> = {};
    if (STORAGE_KEYS.enabled in changes) {
      next.enabled = Boolean(changes[STORAGE_KEYS.enabled].newValue);
    }
    if (STORAGE_KEYS.injected in changes) {
      next.injectedCount = Number(changes[STORAGE_KEYS.injected].newValue ?? 0);
    }
    if (Object.keys(next).length > 0) handler(next);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
