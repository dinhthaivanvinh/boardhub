import { BASIC_MATES_LESSON_ID } from './basic-mates';
import { DRAWS_LESSON_ID, SETUP_LESSON_ID } from './basics';
import { CAPTURE_LESSON_ID } from './capture';
import { CHECKMATE_LESSON_ID } from './checkmate';
import { COORDINATES_LESSON_ID, LESSON_IDS, OPENING_LESSONS, PIECE_LESSONS, SPECIAL_LESSONS } from './data';
import { EARLY_MATE_LESSON_ID, OPENING_BASICS_LESSON_ID } from './opening-basics';
import { TACTICS_LESSON_ID } from './tactics';
import { PRACTICE_LESSON_IDS, practiceId, STARS_PER_PRACTICE } from './practice';
import { PUZZLES } from './puzzles';
import { streak, type PuzzleProgress } from './puzzle-progress';

/** One stop on the way of learning: a few lessons that belong together. The first lesson not done is "next". */
export type JourneyStage = { id: string; lessons: string[] };

export const JOURNEY: readonly JourneyStage[] = [
  { id: 'start', lessons: [COORDINATES_LESSON_ID, SETUP_LESSON_ID] },
  { id: 'pieces', lessons: PIECE_LESSONS.map((l) => l.id) },
  { id: 'rules', lessons: [CAPTURE_LESSON_ID, CHECKMATE_LESSON_ID, DRAWS_LESSON_ID] },
  // Castling and the other special moves are rules: the openings use them, so they come first.
  { id: 'specials', lessons: SPECIAL_LESSONS.map((l) => l.id) },
  { id: 'tactics', lessons: [TACTICS_LESSON_ID, BASIC_MATES_LESSON_ID] },
  {
    id: 'openings',
    // The three ideas and the trap first; the named openings after them are for later.
    lessons: [OPENING_BASICS_LESSON_ID, EARLY_MATE_LESSON_ID, ...OPENING_LESSONS.map((l) => l.id)],
  },
];

/** Every lesson, in the order a child should take them. */
export const JOURNEY_LESSONS: readonly string[] = JOURNEY.flatMap((s) => s.lessons);

/** The lesson to do next: the first one not finished, or null when all are. */
export const nextLessonId = (done: ReadonlySet<string>): string | null =>
  JOURNEY_LESSONS.find((id) => !done.has(id)) ?? null;

/**
 * The lessons there were when the "master" badge was first given. The badge keeps asking for exactly these, so a
 * child who earned it does not lose it when lessons are added. Do not add to this list.
 */
export const MASTER_LESSONS: readonly string[] = [
  COORDINATES_LESSON_ID,
  SETUP_LESSON_ID,
  'pawn',
  'rook',
  'bishop',
  'knight',
  'queen',
  'king',
  CAPTURE_LESSON_ID,
  CHECKMATE_LESSON_ID,
  DRAWS_LESSON_ID,
  'castling',
  'en-passant',
  'promotion',
  TACTICS_LESSON_ID,
  'italian',
  'queens-gambit',
  'sicilian',
  'london',
  'ruy-lopez',
  'french',
];

export const STARS_PER_LESSON = 3;
export const STARS_PER_PUZZLE = 1;

/** The practices finished: each lesson with a practice has one, remembered next to the lessons. */
export const practicesDone = (done: ReadonlySet<string>): number =>
  PRACTICE_LESSON_IDS.filter((id) => done.has(practiceId(id))).length;

/** Stars earned: 3 for every finished lesson, 2 for every practice, 1 for every solved puzzle. */
export function totalStars(done: ReadonlySet<string>, puzzles: PuzzleProgress): number {
  const lessons = JOURNEY_LESSONS.filter((id) => done.has(id)).length;
  const solved = new Set(puzzles.solved.filter((id) => PUZZLES.some((p) => p.id === id))).size;
  return lessons * STARS_PER_LESSON + practicesDone(done) * STARS_PER_PRACTICE + solved * STARS_PER_PUZZLE;
}

/** Ranks, from the first stars to the top. The piece shown with a rank is its glyph. */
export const RANKS = [
  { id: 'chick', at: 0, piece: 'P' },
  { id: 'pawn', at: 10, piece: 'P' },
  { id: 'knight', at: 30, piece: 'N' },
  { id: 'bishop', at: 60, piece: 'B' },
  { id: 'rook', at: 100, piece: 'R' },
  { id: 'queen', at: 160, piece: 'Q' },
  { id: 'king', at: 250, piece: 'K' },
] as const;

export type Rank = (typeof RANKS)[number];

/** The rank for a number of stars, and how many more stars the next rank needs (null at the top). */
export function learnerRank(stars: number): {
  rank: Rank;
  index: number;
  next: Rank | null;
  toNext: number | null;
} {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (stars >= r.at) index = i;
  });
  const next = RANKS[index + 1] ?? null;
  return { rank: RANKS[index]!, index, next, toNext: next ? next.at - stars : null };
}

export type Badge = {
  id: string;
  icon: string;
  earned(done: ReadonlySet<string>, p: PuzzleProgress, today: string): boolean;
};

const all = (done: ReadonlySet<string>, ids: readonly string[]) => ids.every((id) => done.has(id));
const solvedCount = (p: PuzzleProgress) =>
  new Set(p.solved.filter((id) => PUZZLES.some((x) => x.id === id))).size;

/** Badges are worked out from what is stored: nothing extra to keep, and none can be lost. */
export const BADGES: readonly Badge[] = [
  { id: 'first', icon: '🌱', earned: (d) => LESSON_IDS.some((id) => d.has(id)) },
  { id: 'coordinates', icon: '🗺️', earned: (d) => d.has(COORDINATES_LESSON_ID) },
  {
    id: 'pieces',
    icon: '♞',
    earned: (d) =>
      all(
        d,
        PIECE_LESSONS.map((l) => l.id),
      ),
  },
  { id: 'rules', icon: '👑', earned: (d) => all(d, [CAPTURE_LESSON_ID, CHECKMATE_LESSON_ID]) },
  {
    id: 'specials',
    icon: '✨',
    earned: (d) =>
      all(
        d,
        SPECIAL_LESSONS.map((l) => l.id),
      ),
  },
  { id: 'tactics', icon: '🧠', earned: (d) => d.has(TACTICS_LESSON_ID) },
  {
    id: 'openings',
    icon: '🚀',
    earned: (d) =>
      all(
        d,
        OPENING_LESSONS.map((l) => l.id),
      ),
  },
  { id: 'practice5', icon: '💪', earned: (d) => practicesDone(d) >= 5 },
  { id: 'puzzles5', icon: '🧩', earned: (_d, p) => solvedCount(p) >= 5 },
  { id: 'puzzles25', icon: '🎯', earned: (_d, p) => solvedCount(p) >= 25 },
  { id: 'puzzles100', icon: '🏆', earned: (_d, p) => solvedCount(p) >= 100 },
  { id: 'streak3', icon: '🔥', earned: (_d, p, today) => streak(p.days, today) >= 3 },
  { id: 'streak7', icon: '☄️', earned: (_d, p, today) => streak(p.days, today) >= 7 },
  { id: 'master', icon: '🌟', earned: (d) => all(d, MASTER_LESSONS) },
];

export const earnedBadges = (done: ReadonlySet<string>, p: PuzzleProgress, today: string): string[] =>
  BADGES.filter((b) => b.earned(done, p, today)).map((b) => b.id);
