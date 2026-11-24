import { useCallback, useSyncExternalStore } from 'react';
import {
  dateKey,
  EMPTY_PUZZLE_PROGRESS,
  markDone,
  markPuzzleSolved,
  readProgress,
  readPuzzleProgress,
  type LessonId,
  type PuzzleProgress,
} from '@bg/game-chess';

const listeners = new Set<() => void>();
/** Called after progress changed on this device (not after the account's progress was merged in). */
const changeListeners = new Set<() => void>();

export function onProgressChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => void changeListeners.delete(fn);
}

/** Tells every screen that the stored progress changed (it was just written). */
export function notifyProgressWritten(): void {
  listeners.forEach((l) => l());
  puzzleListeners.forEach((l) => l());
}
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
    changeListeners.forEach((l) => l());
  }, []);
}

// ---------------------------------------------------------------------------------------------------------
// Puzzles: solved ones, the days played (for the streak) and "today"

const puzzleListeners = new Set<() => void>();
let puzzleCache: { raw: string; value: PuzzleProgress } | null = null;

function puzzleSnapshot(): PuzzleProgress {
  const value = readPuzzleProgress(storage());
  const raw = JSON.stringify(value);
  if (!puzzleCache || puzzleCache.raw !== raw) puzzleCache = { raw, value };
  return puzzleCache.value;
}

export function usePuzzleProgress(): PuzzleProgress {
  return useSyncExternalStore(
    (notify) => {
      puzzleListeners.add(notify);
      return () => void puzzleListeners.delete(notify);
    },
    puzzleSnapshot,
    () => EMPTY_PUZZLE_PROGRESS,
  );
}

export function useMarkPuzzle() {
  return useCallback((id: string, today: string, daily: boolean) => {
    markPuzzleSolved(storage(), id, today, daily);
    puzzleListeners.forEach((l) => l());
    changeListeners.forEach((l) => l());
  }, []);
}

/** Today's date as the child sees it ("YYYY-MM-DD"); empty on the server and until the page is on the screen. */
export function useToday(): string {
  return useSyncExternalStore(
    () => () => {},
    () => dateKey(new Date()),
    () => '',
  );
}
