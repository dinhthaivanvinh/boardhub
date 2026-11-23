import { useCallback, useSyncExternalStore } from 'react';
import { markDone, readProgress, type LessonId } from '@bg/game-chess';

const listeners = new Set<() => void>();
let cache: { raw: string; set: ReadonlySet<string> } | null = null;
const EMPTY: ReadonlySet<string> = new Set();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A stable snapshot: the same Set until the stored progress changes. */
function snapshot(): ReadonlySet<string> {
  const set = readProgress(storage());
  const raw = [...set].sort().join(',');
  if (!cache || cache.raw !== raw) cache = { raw, set };
  return cache.set;
}

export function useDoneLessons(): ReadonlySet<string> {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => void listeners.delete(notify);
    },
    snapshot,
    () => EMPTY,
  );
}

export function useMarkDone() {
  return useCallback((id: string) => {
    markDone(storage(), id as LessonId);
    listeners.forEach((l) => l());
  }, []);
}
