import type { SkillKind } from './puzzle-kinds';
import { SKILL_PUZZLE_DATA } from './puzzle-kinds-data';
import { PUZZLE_DATA } from './puzzle-data';

/** A "mate in one" puzzle: White to move, find the checkmate. Easy (1) to hard (3). */
export type PuzzleTier = 1 | 2 | 3;
export type Puzzle = { id: string; tier: PuzzleTier; fen: string };
/** A puzzle that trains one skill (see puzzle-kinds.ts). White to move. */
export type SkillPuzzle = { id: string; kind: SkillKind; fen: string };

export const PUZZLE_TIERS: readonly PuzzleTier[] = [1, 2, 3];
export const MATE_PUZZLES: readonly Puzzle[] = PUZZLE_DATA;
export const SKILL_PUZZLES: readonly SkillPuzzle[] = SKILL_PUZZLE_DATA;
/** Every puzzle, for what counts them all: stars, badges, saved progress and statistics. */
export const PUZZLES: readonly { id: string; fen: string }[] = [...MATE_PUZZLES, ...SKILL_PUZZLES];

export const puzzlesOfTier = (tier: PuzzleTier): Puzzle[] => MATE_PUZZLES.filter((p) => p.tier === tier);
export const puzzlesOfKind = (kind: SkillKind): SkillPuzzle[] => SKILL_PUZZLES.filter((p) => p.kind === kind);

/** The first puzzle of the tier that is not solved yet (the first one when all are solved). */
export const nextPuzzle = (tier: PuzzleTier, solved: ReadonlySet<string>, after?: string): Puzzle | null =>
  nextIn(puzzlesOfTier(tier), solved, after);

/** The same for any list of puzzles. */
export function nextIn<T extends { id: string }>(
  list: readonly T[],
  solved: ReadonlySet<string>,
  after?: string,
): T | null {
  const start = after ? list.findIndex((p) => p.id === after) + 1 : 0;
  const order = [...list.slice(start), ...list.slice(0, start)];
  return order.find((p) => !solved.has(p.id)) ?? null;
}

/** Mostly easy ones, a medium one most days and a hard one once a week. */
const DAILY_CYCLE: readonly PuzzleTier[] = [1, 1, 2, 1, 2, 2, 3];

/** Whole days since 1970-01-01 of a "YYYY-MM-DD" key (no time zone involved). */
export const dayNumber = (dateKey: string): number => {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** The puzzle of the day: the same for everybody on the same date, a new one every day, then it starts over. */
export function dailyPuzzle(dateKey: string): Puzzle {
  const day = dayNumber(dateKey);
  const slot = ((day % DAILY_CYCLE.length) + DAILY_CYCLE.length) % DAILY_CYCLE.length;
  const tier = DAILY_CYCLE[slot]!;
  const sameBefore = DAILY_CYCLE.slice(0, slot).filter((t) => t === tier).length;
  const perCycle = DAILY_CYCLE.filter((t) => t === tier).length;
  const k = Math.floor(day / DAILY_CYCLE.length) * perCycle + sameBefore;
  const list = puzzlesOfTier(tier);
  return list[((k % list.length) + list.length) % list.length]!;
}
