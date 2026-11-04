// Test-only game: 3x3 tic-tac-toe. Small enough for minimax to play perfectly.
import { z } from 'zod';
import type { GameDefinition, Seat } from '@bg/engine';

export type TttState = { board: (Seat | null)[]; turn: Seat };
export type TttMove = { cell: number };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function winnerOf(board: (Seat | null)[]): Seat | null {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v !== null && v !== undefined && v === board[b] && v === board[c]) return v;
  }
  return null;
}

export const ttt: GameDefinition<TttState, TttMove, Record<string, never>> = {
  meta: {
    id: 'ttt',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['perfect-info'],
    estimatedMinutes: 1,
    i18nKey: 'games.ttt',
  },
  configSchema: z.strictObject({}),
  moveSchema: z.strictObject({ cell: z.number().int() }),
  setup: () => ({ board: Array.from({ length: 9 }, () => null), turn: 0 }),
  activePlayers: (s) => (ttt.result(s) ? [] : [s.turn]),
  validateMove: (s, _seat, m) =>
    m.cell >= 0 && m.cell < 9 && s.board[m.cell] === null ? { ok: true } : { ok: false, code: 'ttt.bad' },
  applyMove: (s, seat, m) => {
    const board = s.board.slice();
    board[m.cell] = seat;
    return { board, turn: seat === 0 ? 1 : 0 };
  },
  legalMoves: (s) => s.board.flatMap((v, cell) => (v === null ? [{ cell }] : [])),
  result: (s) => {
    const w = winnerOf(s.board);
    if (w !== null) return { kind: 'win', winners: [w], reason: 'three' };
    return s.board.every((v) => v !== null) ? { kind: 'draw', reason: 'full' } : null;
  },
  playerView: (s) => s,
};

/** Board from a string like "XO.|.X.|..O" (X = seat 0, O = seat 1). */
export function board(rows: string, turn: Seat): TttState {
  const cells = rows.replaceAll('|', '').split('');
  return { board: cells.map((c) => (c === 'X' ? 0 : c === 'O' ? 1 : null)), turn };
}

/** Lines still open for `seat`, minus the opponent's. Good enough as a heuristic. */
export function evaluate(s: TttState, seat: Seat): number {
  let score = 0;
  for (const line of LINES) {
    const vals = line.map((i) => s.board[i]);
    const mine = vals.filter((v) => v === seat).length;
    const theirs = vals.filter((v) => v !== null && v !== seat).length;
    if (theirs === 0) score += mine * mine;
    if (mine === 0) score -= theirs * theirs;
  }
  return score;
}
