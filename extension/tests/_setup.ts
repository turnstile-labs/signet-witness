/**
 * Lightweight `chrome.*` shim for vitest.
 *
 * The real Chrome runtime is only available inside an installed
 * extension; vitest runs in node + happy-dom, so anything that
 * touches `chrome.storage`, `chrome.runtime`, or `chrome.tabs` would
 * blow up at import time without this stub.
 *
 * We model only the surface our libs actually use:
 *   - chrome.storage.local: a Map-backed store with get/set/remove.
 *   - chrome.storage.sync : a separate Map (kept distinct because the
 *                          two areas have different quotas in real
 *                          Chrome and we want our tests to catch any
 *                          accidental cross-area writes).
 *   - chrome.storage.onChanged: a no-op listener registry — tests
 *                               that exercise change subscriptions
 *                               can wire it up explicitly.
 *
 * Reset the store between tests via `resetChromeStores()` so leakage
 * doesn't show up as flakiness.
 */

import { beforeEach, vi } from "vitest";

type StorageRecord = Record<string, unknown>;

interface MockStorageArea {
  store: Map<string, unknown>;
  get: (
    keys?: string | string[] | StorageRecord | null,
  ) => Promise<StorageRecord>;
  set: (items: StorageRecord) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

function makeArea(): MockStorageArea {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(keys) {
      if (keys == null) {
        return Object.fromEntries(store);
      }
      if (typeof keys === "string") {
        return store.has(keys) ? { [keys]: store.get(keys) } : {};
      }
      if (Array.isArray(keys)) {
        const out: StorageRecord = {};
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
        return out;
      }
      const out: StorageRecord = {};
      for (const [k, fallback] of Object.entries(keys)) {
        out[k] = store.has(k) ? store.get(k) : fallback;
      }
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) store.delete(k);
    },
    async clear() {
      store.clear();
    },
  };
}

const localArea = makeArea();
const syncArea = makeArea();

const chromeShim = {
  storage: {
    local: localArea,
    sync: syncArea,
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    getManifest: () => ({ version: "0.0.0-test" }),
    onMessageExternal: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  tabs: {
    create: vi.fn(),
    sendMessage: vi.fn(),
  },
};

(globalThis as unknown as { chrome: typeof chromeShim }).chrome = chromeShim;

export function resetChromeStores(): void {
  localArea.store.clear();
  syncArea.store.clear();
  vi.mocked(chromeShim.storage.onChanged.addListener).mockClear();
  vi.mocked(chromeShim.storage.onChanged.removeListener).mockClear();
}

beforeEach(() => {
  resetChromeStores();
});
