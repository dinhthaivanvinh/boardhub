import { useCallback, useSyncExternalStore } from 'react';
import { readMiniProgress, saveMiniStars, type MiniGameId, type MiniProgress } from '@bg/game-chess';

const listeners = new Set<() => void>();
let cache: { raw: string; value: MiniProgress } | null = null;
const EMPTY: MiniProgress = {};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The same object until the stored stars change. */
function snapshot(): MiniProgress {
  const value = readMiniProgress(storage());
  const raw = JSON.stringify(value);
  if (!cache || cache.raw !== raw) cache = { raw, value };
  return cache.value;
}

/** The best stars of the little games, kept on this device only. */
export function useMiniProgress(): MiniProgress {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => void listeners.delete(notify);
    },
    snapshot,
    () => EMPTY,
  );
}

export function useSaveMiniStars() {
  return useCallback((game: MiniGameId, level: number, stars: number) => {
    saveMiniStars(storage(), game, level, stars);
    listeners.forEach((l) => l());
  }, []);
}
