import { useSyncExternalStore } from 'react';
import { DEFAULT_SKIN, SKIN_STORAGE_KEY, isSkinId, type SkinId } from './skins';

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so the selector still works in memory
let memorySkin: SkinId | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function getSnapshot(): SkinId {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (isSkinId(stored)) return stored;
  } catch {}
  return memorySkin ?? DEFAULT_SKIN;
}

function getServerSnapshot(): SkinId {
  return DEFAULT_SKIN;
}

export function setSkin(id: SkinId) {
  memorySkin = id;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch {}
  listeners.forEach((cb) => cb());
}

export function useSkin(): [SkinId, (id: SkinId) => void] {
  const skin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [skin, setSkin];
}
