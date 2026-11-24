import type { LessonId } from './data';

export const PROGRESS_KEY = 'learn.chess.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Finished lessons. Storage can be missing or throw (private mode), then nothing is remembered. */
export function readProgress(store: Store | null): Set<string> {
  try {
    const raw = store?.getItem(PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Replaces the remembered lessons (e.g. after merging with the account's). Storage may be missing. */
export function writeProgress(store: Store | null, ids: Iterable<string>): void {
  try {
    store?.setItem(PROGRESS_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* not remembered */
  }
}

export function markDone(store: Store | null, id: LessonId): Set<string> {
  const done = readProgress(store);
  done.add(id);
  try {
    store?.setItem(PROGRESS_KEY, JSON.stringify([...done]));
  } catch {
    /* not remembered */
  }
  return done;
}
