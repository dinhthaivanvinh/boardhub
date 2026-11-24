import { dayNumber } from './puzzles';

export const PUZZLE_PROGRESS_KEY = 'learn.chess.puzzles.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** What is remembered on this device: puzzles solved, the days a puzzle was solved on, and the days of the daily one. */
export type PuzzleProgress = { solved: string[]; days: string[]; daily: string[] };
export const EMPTY_PUZZLE_PROGRESS: PuzzleProgress = { solved: [], days: [], daily: [] };

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/** Local "YYYY-MM-DD" of a date: a child's day ends at their own midnight. */
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function readPuzzleProgress(store: Store | null): PuzzleProgress {
  try {
    const raw = store?.getItem(PUZZLE_PROGRESS_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    return { solved: strings(parsed.solved), days: strings(parsed.days), daily: strings(parsed.daily) };
  } catch {
    return EMPTY_PUZZLE_PROGRESS;
  }
}

/** Replaces the remembered puzzle progress (e.g. after merging with the account's). Storage may be missing. */
export function writePuzzleProgress(store: Store | null, progress: PuzzleProgress): void {
  try {
    store?.setItem(PUZZLE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* not remembered */
  }
}

/** Remembers a solved puzzle on `today`; `daily` when it was the puzzle of the day. Storage may be missing. */
export function markPuzzleSolved(
  store: Store | null,
  id: string,
  today: string,
  daily = false,
): PuzzleProgress {
  const now = readPuzzleProgress(store);
  const add = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);
  const next: PuzzleProgress = {
    solved: add(now.solved, id),
    // Only the last year is kept: the streak never needs more.
    days: add(now.days, today).slice(-400),
    daily: daily ? add(now.daily, today).slice(-400) : now.daily,
  };
  try {
    store?.setItem(PUZZLE_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* not remembered */
  }
  return next;
}

/**
 * Days in a row with a solved puzzle, ending today. A child who has not played yet today keeps yesterday's
 * streak (they still can play), so the streak breaks only after a whole day is missed.
 */
export function streak(days: readonly string[], today: string): number {
  const set = new Set(days.map(dayNumber));
  let day = dayNumber(today);
  if (!set.has(day)) day -= 1;
  let n = 0;
  while (set.has(day)) {
    n++;
    day -= 1;
  }
  return n;
}
