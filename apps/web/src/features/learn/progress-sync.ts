import {
  LESSON_IDS,
  PRACTICE_LESSON_IDS,
  practiceId,
  PUZZLES,
  readProgress,
  readPuzzleProgress,
  writeProgress,
  writePuzzleProgress,
} from '@bg/game-chess';
import { LearnProgressSchema, mergeLearnProgress, sameLearnProgress, type LearnProgress } from '@bg/protocol';
import { apiRequest } from '@/online/api';
import { notifyProgressWritten } from './use-progress';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** What this device remembers, in the shape the account stores. */
export function readLocalProgress(): LearnProgress {
  const store = storage();
  const puzzles = readPuzzleProgress(store);
  return {
    lessons: [...readProgress(store)],
    puzzles: puzzles.solved,
    days: puzzles.days,
    daily: puzzles.daily,
  };
}

/** Writes the merged progress to this device. Ids this version does not know are left out. */
function writeLocalProgress(p: LearnProgress): void {
  const store = storage();
  // Lessons, and the practices finished (stored next to them).
  const lessons = new Set<string>([...LESSON_IDS, ...PRACTICE_LESSON_IDS.map(practiceId)]);
  const puzzles = new Set(PUZZLES.map((x) => x.id));
  writeProgress(
    store,
    p.lessons.filter((id) => lessons.has(id)),
  );
  writePuzzleProgress(store, {
    solved: p.puzzles.filter((id) => puzzles.has(id)),
    days: p.days,
    daily: p.daily,
  });
  notifyProgressWritten();
}

export type SyncResult = 'saved' | 'failed';

/**
 * Brings this device and the account to the same progress: the union of both, written to both. Nothing is
 * ever taken away from either side, so signing in on a second device only adds.
 */
export async function syncProgress(token: string): Promise<SyncResult> {
  const local = readLocalProgress();
  const res = await apiRequest<{ progress: unknown }>('PUT', '/api/me/progress', { progress: local }, token);
  if (!res.ok) return 'failed';
  const server = LearnProgressSchema.safeParse(res.data.progress);
  if (!server.success) return 'failed';
  // Another save may have happened while the request was out: merge with what is on the device now.
  const merged = mergeLearnProgress(readLocalProgress(), server.data);
  if (!sameLearnProgress(merged, readLocalProgress())) writeLocalProgress(merged);
  return 'saved';
}
