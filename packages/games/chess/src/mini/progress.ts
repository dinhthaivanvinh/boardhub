/** The best stars of every level of the small games, kept on this device. */
import { KNIGHT_LEVELS } from './knight-stars';
import { MINI_GAME_IDS, type MiniGameId } from './common';
import { PAWN_LEVELS } from './pawn-race';
import { ROOK_LEVELS } from './rook-wall';

export const MINI_PROGRESS_KEY = 'learn.chess.mini.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const MINI_LEVELS: Record<MiniGameId, number> = {
  'knight-stars': KNIGHT_LEVELS.length,
  'rook-wall': ROOK_LEVELS.length,
  'pawn-race': PAWN_LEVELS.length,
};

export const isMiniGameId = (id: string): id is MiniGameId =>
  (MINI_GAME_IDS as readonly string[]).includes(id);

/** "knight-stars:3" → 1, 2 or 3 stars. Levels are numbered from 1. */
export type MiniProgress = Record<string, number>;
export const miniKey = (game: MiniGameId, level: number) => `${game}:${level}`;

export function readMiniProgress(store: Store | null): MiniProgress {
  try {
    const parsed = JSON.parse(store?.getItem(MINI_PROGRESS_KEY) ?? '{}') as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v === 1 || v === 2 || v === 3),
    ) as MiniProgress;
  } catch {
    return {};
  }
}

/** Remembers a finished level; a worse try never takes stars away. Storage may be missing. */
export function saveMiniStars(
  store: Store | null,
  game: MiniGameId,
  level: number,
  stars: number,
): MiniProgress {
  const now = readMiniProgress(store);
  const key = miniKey(game, level);
  if (stars < 1 || (now[key] ?? 0) >= stars) return now;
  const next = { ...now, [key]: Math.min(3, stars) };
  try {
    store?.setItem(MINI_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* not remembered */
  }
  return next;
}

/** 3 stars for the shortest way, 2 for a few moves more, 1 for getting there. */
export const starsForMoves = (moves: number, par: number): number =>
  moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
