import { useSyncExternalStore } from 'react';

interface SkinStore {
  listeners: Set<() => void>;
  // Used when localStorage is unavailable, so the selector still works in memory
  memory: string | undefined;
  subscribe: (cb: () => void) => () => void;
}

// One store per storage key, shared by every component that reads that game's skin
const stores = new Map<string, SkinStore>();

function getStore(storageKey: string): SkinStore {
  let store = stores.get(storageKey);
  if (!store) {
    const listeners = new Set<() => void>();
    store = {
      listeners,
      memory: undefined,
      subscribe(cb) {
        listeners.add(cb);
        window.addEventListener('storage', cb);
        return () => {
          listeners.delete(cb);
          window.removeEventListener('storage', cb);
        };
      },
    };
    stores.set(storageKey, store);
  }
  return store;
}

export function setGameSkin(storageKey: string, id: string) {
  const store = getStore(storageKey);
  store.memory = id;
  try {
    localStorage.setItem(storageKey, id);
  } catch {}
  store.listeners.forEach((cb) => cb());
}

/**
 * Persisted skin selection for a canvas game.
 * Unknown stored values (e.g. a removed skin id) fall back to `defaultId`.
 */
export function useGameSkin<T extends string>(
  storageKey: string,
  ids: readonly T[],
  defaultId: T,
): [T, (id: T) => void] {
  const store = getStore(storageKey);
  const isValid = (value: unknown): value is T =>
    typeof value === 'string' && (ids as readonly string[]).includes(value);

  const skin = useSyncExternalStore(
    store.subscribe,
    () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (isValid(stored)) return stored;
      } catch {}
      return isValid(store.memory) ? store.memory : defaultId;
    },
    () => defaultId,
  );

  return [skin, (id: T) => setGameSkin(storageKey, id)];
}
