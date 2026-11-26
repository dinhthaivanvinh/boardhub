import type { GameResultView } from './schemas';
import { z } from 'zod';

const DisplayName = z.string().trim().min(2).max(24);

export const GuestRequest = z.strictObject({ displayName: DisplayName.optional() });
export const RegisterRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  displayName: DisplayName,
});
export const LoginRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const RenameRequest = z.strictObject({ displayName: DisplayName });

export type UserKind = 'guest' | 'registered';

export interface PublicUser {
  id: string;
  kind: UserKind;
  displayName: string;
  email: string | null;
  /** Can open /admin (has the super_admin role). */
  admin: boolean;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ApiError {
  code: string;
}

export interface MatchPlayerInfo {
  seat: number;
  userId: string | null;
  /** Display name for users, null for bots. */
  name: string | null;
  botLevel: string | null;
}

/** One row of a player's match history (GET /api/me/matches). */
export interface MatchSummary {
  id: string;
  roomCode: string;
  gameId: string;
  status: 'playing' | 'finished';
  result: GameResultView | null;
  startedAt: number;
  endedAt: number | null;
  players: MatchPlayerInfo[];
}

/** A finished match with everything needed to replay it (GET /api/matches/:id). */
export interface MatchDetail extends MatchSummary {
  rulesVersion: number;
  config: Record<string, unknown>;
  /** Revealed only once the match is over. */
  seed: string;
  moves: { seat: number; move: unknown }[];
}

export interface UserRating {
  gameId: string;
  rating: number;
  rd: number;
  /** Not enough games yet for the rating to be reliable. */
  provisional: boolean;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface LeaderboardEntry extends UserRating {
  rank: number;
  userId: string;
  name: string;
}

/** A public game being played now (GET /api/live). */
export interface LiveRoom {
  roomId: string;
  code: string;
  gameId: string;
  ranked: boolean;
  startedAt: number;
  spectatorCount: number;
  players: { seat: number; name: string; rating: number | null }[];
}

// ---------------------------------------------------------------------------------------------------------
// Learning progress (lessons done, puzzles solved, days played): kept on the account so a child's journey
// follows them from one device to another. Only plain ids and dates: nothing personal.

const LearnId = z.string().regex(/^[a-z0-9-]{1,40}$/);
const LearnDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LEARN_PROGRESS_LIMITS = { lessons: 100, puzzles: 1000, days: 400 } as const;

export const LearnProgressSchema = z.strictObject({
  /** Lesson ids finished. */
  lessons: z.array(LearnId).max(LEARN_PROGRESS_LIMITS.lessons),
  /** Puzzle ids solved. */
  puzzles: z.array(LearnId).max(LEARN_PROGRESS_LIMITS.puzzles),
  /** Local dates ("YYYY-MM-DD") a puzzle was solved on: the streak of days. */
  days: z.array(LearnDay).max(LEARN_PROGRESS_LIMITS.days),
  /** Local dates the puzzle of the day was solved on. */
  daily: z.array(LearnDay).max(LEARN_PROGRESS_LIMITS.days),
});
export type LearnProgress = z.infer<typeof LearnProgressSchema>;

export const LearnProgressRequest = z.strictObject({ progress: LearnProgressSchema });

export const EMPTY_LEARN_PROGRESS: LearnProgress = { lessons: [], puzzles: [], days: [], daily: [] };

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

/**
 * The union of two progresses: nothing either side has earned is ever lost, whichever device is merged first.
 * Days are kept sorted and only the latest ones (the streak never needs more).
 */
export function mergeLearnProgress(a: LearnProgress, b: LearnProgress): LearnProgress {
  const days = (x: readonly string[], y: readonly string[]) =>
    union(x, y).sort().slice(-LEARN_PROGRESS_LIMITS.days);
  return {
    lessons: union(a.lessons, b.lessons).slice(0, LEARN_PROGRESS_LIMITS.lessons),
    puzzles: union(a.puzzles, b.puzzles).slice(0, LEARN_PROGRESS_LIMITS.puzzles),
    days: days(a.days, b.days),
    daily: days(a.daily, b.daily),
  };
}

/** True when both hold exactly the same lessons, puzzles and days (order does not matter). */
export function sameLearnProgress(a: LearnProgress, b: LearnProgress): boolean {
  const same = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && new Set([...x, ...y]).size === x.length;
  return (
    same(a.lessons, b.lessons) && same(a.puzzles, b.puzzles) && same(a.days, b.days) && same(a.daily, b.daily)
  );
}
