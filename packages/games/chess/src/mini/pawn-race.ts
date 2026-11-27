/**
 * "Đua Tốt": only pawns. Whoever gets a pawn to the far side first wins, and so does whoever takes all the
 * other side's pawns. A side that cannot move at its turn makes it a draw.
 */
import type { Rng } from '@bg/engine';
import { rowOf } from '../rules/board';
import type { ChessMove } from '../rules/types';
import { apply, boardWith, type MiniBoard, pawnMoves, squaresOf } from './common';

export type Side = 'w' | 'b';
export type PawnState = { board: MiniBoard; turn: Side; enPassant: number | null };

export type PawnLevel = {
  files: string;
  /** How far the computer looks ahead; 0: barely at all. */ depth: number;
};

export const PAWN_LEVELS: readonly PawnLevel[] = [
  { files: 'cde', depth: 0 },
  { files: 'bcdef', depth: 2 },
  { files: 'abcdefgh', depth: 4 },
];

export function pawnStart(level: PawnLevel): PawnState {
  const files = [...level.files];
  return {
    board: boardWith({ wP: files.map((f) => `${f}2`), bP: files.map((f) => `${f}7`) }),
    turn: 'w',
    enPassant: null,
  };
}

export const allMoves = (s: PawnState): ChessMove[] =>
  squaresOf(s.board, s.turn).flatMap((from) => pawnMoves(s.board, from, s.enPassant));

export function playPawn(s: PawnState, move: ChessMove): PawnState {
  const board = apply(s.board, move);
  // En passant: the pawn taken stands beside the square moved to.
  if (move.to === s.enPassant && !s.board[move.to]) board[move.to + (s.turn === 'w' ? 8 : -8)] = null;
  const double = Math.abs(rowOf(move.to) - rowOf(move.from)) === 2;
  return {
    board,
    turn: s.turn === 'w' ? 'b' : 'w',
    enPassant: double ? (move.from + move.to) / 2 : null,
  };
}

export type PawnResult = { winner: Side; why: 'reached' | 'noPawns' } | { winner: null; why: 'stuck' };

export function pawnResult(s: PawnState): PawnResult | null {
  for (let col = 0; col < 8; col++) {
    if (s.board[col] === 'wP') return { winner: 'w', why: 'reached' };
    if (s.board[56 + col] === 'bP') return { winner: 'b', why: 'reached' };
  }
  if (squaresOf(s.board, 'b').length === 0) return { winner: 'w', why: 'noPawns' };
  if (squaresOf(s.board, 'w').length === 0) return { winner: 'b', why: 'noPawns' };
  return allMoves(s).length === 0 ? { winner: null, why: 'stuck' } : null;
}

const WIN = 1_000_000;

/** How good the position is for White: pawns left, how far they are, and whether one has a free road. */
function judge(board: MiniBoard): number {
  let score = 0;
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p) continue;
    const color = p[0] as Side;
    const gone = color === 'w' ? 6 - rowOf(s) : rowOf(s) - 1;
    const dir = color === 'w' ? -1 : 1;
    // Free road: no enemy pawn ahead on this file or the files beside it.
    let free = true;
    for (let row = rowOf(s) + dir; row >= 0 && row < 8 && free; row += dir) {
      for (const dc of [-1, 0, 1]) {
        const col = (s % 8) + dc;
        if (col >= 0 && col < 8 && board[row * 8 + col]?.[0] === (color === 'w' ? 'b' : 'w')) free = false;
      }
    }
    const value = 100 + gone * gone * 4 + (free ? 60 + gone * 25 : 0);
    score += color === 'w' ? value : -value;
  }
  return score;
}

function search(s: PawnState, depth: number, alpha: number, beta: number): number {
  const sign = s.turn === 'w' ? 1 : -1;
  const result = pawnResult(s);
  if (result) return result.winner === null ? 0 : (result.winner === s.turn ? 1 : -1) * (WIN + depth);
  if (depth === 0) return sign * judge(s.board);
  let best = -Infinity;
  for (const move of allMoves(s)) {
    const score = -search(playPawn(s, move), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The best move found looking `depth` plies ahead; among equals the first in board order, or one picked by `rng`. */
export function bestPawnMove(s: PawnState, depth: number, rng?: Rng): ChessMove | null {
  let best: ChessMove[] = [];
  let top = -Infinity;
  for (const move of allMoves(s)) {
    const score = -search(playPawn(s, move), Math.max(0, depth - 1), -Infinity, Infinity);
    if (score > top) {
      top = score;
      best = [move];
    } else if (score === top) {
      best.push(move);
    }
  }
  if (best.length === 0) return null;
  return best[rng ? rng.int(0, best.length) : 0]!;
}

/** Chance that the gentlest computer takes or promotes when it can. */
export const GENTLE_PAWN_CHANCE = 0.4;

/** The computer's move at a level. At depth 0 it moves at random, and only sometimes takes or wins at once. */
export function computerPawnMove(s: PawnState, level: PawnLevel, rng: Rng): ChessMove | null {
  const moves = allMoves(s);
  if (moves.length === 0) return null;
  if (level.depth > 0) return bestPawnMove(s, level.depth, rng);
  const sharp = moves.filter((m) => s.board[m.to] !== null || rowOf(m.to) === (s.turn === 'w' ? 0 : 7));
  if (sharp.length > 0 && rng.next() < GENTLE_PAWN_CHANCE) return sharp[rng.int(0, sharp.length)]!;
  return moves[rng.int(0, moves.length)]!;
}
