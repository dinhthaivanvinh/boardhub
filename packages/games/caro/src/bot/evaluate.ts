import type { Seat } from '@bg/engine';
import type { CaroMove, CaroState } from '../rules/types';

const WINDOW = 5;
/** Score of a 5-cell window holding n pieces of one colour and none of the other. */
const WINDOW_SCORE = [0, 1, 10, 100, 1_000, 100_000];
/** Score for joining/blocking a run of n pieces when ordering moves. */
const RUN_SCORE = [0, 1, 8, 64, 10_000];
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

const windowCache = new Map<number, Int16Array>();

/** Every 5-cell line on the board, flattened: cells [i*5 .. i*5+4] form window i. */
function windowsFor(size: number): Int16Array {
  const cached = windowCache.get(size);
  if (cached) return cached;
  const cells: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endR = r + dr * (WINDOW - 1);
        const endC = c + dc * (WINDOW - 1);
        if (endR >= size || endC < 0 || endC >= size) continue;
        for (let k = 0; k < WINDOW; k++) cells.push((r + dr * k) * size + (c + dc * k));
      }
    }
  }
  const windows = Int16Array.from(cells);
  windowCache.set(size, windows);
  return windows;
}

/** Positional score for `seat`: open lines it could still complete minus the opponent's. */
export function evaluate(s: CaroState, seat: Seat): number {
  const windows = windowsFor(s.config.size);
  // The side to move gets a small bonus: its threats are one tempo closer.
  const mineWeight = s.turn === seat ? 1.2 : 1;
  const theirsWeight = s.turn === seat ? 1 : 1.2;
  let total = 0;
  for (let i = 0; i < windows.length; i += WINDOW) {
    let mine = 0;
    let theirs = 0;
    for (let k = 0; k < WINDOW; k++) {
      const v = s.board[windows[i + k] as number];
      if (v === null || v === undefined) continue;
      if (v === seat) mine++;
      else theirs++;
    }
    if (theirs === 0) total += (WINDOW_SCORE[mine] as number) * mineWeight;
    else if (mine === 0) total -= (WINDOW_SCORE[theirs] as number) * theirsWeight;
  }
  return total;
}

/** Empty cells within distance 2 of any piece (the centre on an empty board). */
export function candidateMoves(s: CaroState): CaroMove[] {
  const { size } = s.config;
  if (s.moveCount === 0) return [{ cell: Math.floor(size / 2) * size + Math.floor(size / 2) }];
  const near = new Uint8Array(size * size);
  s.board.forEach((v, cell) => {
    if (v === null) return;
    const r = Math.floor(cell / size);
    const c = cell % size;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) near[rr * size + cc] = 1;
      }
    }
  });
  const moves: CaroMove[] = [];
  near.forEach((flag, cell) => {
    if (flag && s.board[cell] === null) moves.push({ cell });
  });
  return moves;
}

/** Longest run of `piece` through `cell` (as if a piece were placed there), per direction. */
function runsThrough(s: CaroState, cell: number, piece: Seat): number[] {
  const { size } = s.config;
  const r0 = Math.floor(cell / size);
  const c0 = cell % size;
  return DIRECTIONS.map(([dr, dc]) => {
    let run = 0;
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < size && c >= 0 && c < size && s.board[r * size + c] === piece) {
        run++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    return run;
  });
}

/** Moves that extend our lines or cut the opponent's come first. */
export function orderMoves(s: CaroState, moves: CaroMove[], seat: Seat): CaroMove[] {
  const opponent = seat === 0 ? 1 : 0;
  const scoreOf = (cell: number) => {
    let score = 0;
    for (const run of runsThrough(s, cell, seat)) score += RUN_SCORE[Math.min(run, 4)] as number;
    for (const run of runsThrough(s, cell, opponent)) score += (RUN_SCORE[Math.min(run, 4)] as number) * 0.9;
    return score;
  };
  return moves
    .map((m) => ({ m, score: scoreOf(m.cell) }))
    .sort((a, b) => b.score - a.score || a.m.cell - b.m.cell)
    .map((x) => x.m);
}
