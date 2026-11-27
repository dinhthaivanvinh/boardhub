/**
 * The puzzles that are not "mate in one": take what is free, save a piece, fork, mate in two. Which moves are
 * right is always worked out by the engine, never written by hand; the generator keeps positions where the
 * answer is clear. No React here.
 */
import { describe, inCheck, legalMoves, makeMove } from '../rules/board';
import type { ChessMove, PieceType, Position } from '../rules/types';
import { lossesAt, netGain, threatenedSquares, winsMaterial } from '../exchange';
import { PIECE_VALUE } from './capture';
import { isCheckmate, isStalemate, matingMoves } from './checkmate';
import { forkMoves } from './tactics';

export type SkillKind = 'free' | 'save' | 'fork' | 'mate2';
export const SKILL_KINDS: readonly SkillKind[] = ['free', 'save', 'fork', 'mate2'];

/** A piece worth at least a knight or bishop: what these puzzles are about. */
export const BIG = PIECE_VALUE.N;

const worth = (pos: Position, move: ChessMove): number => {
  const piece = describe(pos, move).captured;
  return piece ? PIECE_VALUE[piece[1] as PieceType] : 0;
};

/** Captures that come out at least a minor piece ahead after the whole exchange. */
export const freeCaptures = (pos: Position): ChessMove[] =>
  legalMoves(pos).filter((m) => worth(pos, m) > 0 && netGain(pos, m) >= BIG);

/** After the move nothing of mine can be won, it did not lose material itself, and it allows no mate in one. */
export function savesEverything(pos: Position, move: ChessMove): boolean {
  if (netGain(pos, move) < 0) return false;
  const next = makeMove(pos, move);
  return lossesAt(next, pos.turn).size === 0 && matingMoves(next).length === 0 && !isStalemate(next);
}
export const savingMoves = (pos: Position): ChessMove[] =>
  legalMoves(pos).filter((m) => savesEverything(pos, m));

/** A fork that really wins: whatever the answer, something at least as big as a knight can then be won. */
export const winningForks = (pos: Position): ChessMove[] =>
  forkMoves(pos).filter((move) => {
    const after = makeMove(pos, move);
    const replies = legalMoves(after);
    return (
      replies.length > 0 &&
      matingMoves(after).length === 0 &&
      replies.every((reply) => {
        const then = makeMove(after, reply);
        const win = winsMaterial(then);
        return win !== null && netGain(then, win) >= BIG && matingMoves(then).length === 0;
      })
    );
  });

/** First moves after which every answer can be mated at once. */
export function mateInTwoKeys(pos: Position): ChessMove[] {
  return legalMoves(pos).filter((move) => {
    const after = makeMove(pos, move);
    const replies = legalMoves(after);
    return replies.length > 0 && replies.every((r) => matingMoves(makeMove(after, r)).length > 0);
  });
}

/** The defender's answer in a mate in two: the one that leaves the fewest ways to mate. Always the same one. */
export function toughestReply(after: Position): ChessMove | null {
  let best: ChessMove | null = null;
  let fewest = Infinity;
  for (const reply of legalMoves(after)) {
    const ways = matingMoves(makeMove(after, reply)).length;
    if (ways < fewest) {
      best = reply;
      fewest = ways;
    }
  }
  return best;
}

/** The moves that solve the position at this step (mate in two has two steps; the others one). */
export function solutions(kind: SkillKind, pos: Position, step = 0): ChessMove[] {
  switch (kind) {
    case 'free':
      return freeCaptures(pos);
    case 'save':
      return savingMoves(pos);
    case 'fork':
      return winningForks(pos);
    case 'mate2':
      return step === 0 ? mateInTwoKeys(pos) : matingMoves(pos);
  }
}

export type PuzzleVerdict =
  /** Right; with `reply` the puzzle goes on after that answer. */
  | { ok: true; reply?: ChessMove | undefined }
  /** Not it, and why (a text key under `puzzles.kinds.<kind>.why`); `reply` shows it on the board. */
  | { ok: false; why: string; reply?: ChessMove | undefined };

const same = (a: ChessMove, b: ChessMove) =>
  a.from === b.from && a.to === b.to && a.promotion === b.promotion;

export function judgePuzzle(kind: SkillKind, pos: Position, move: ChessMove, step = 0): PuzzleVerdict {
  const right = solutions(kind, pos, step).some((m) => same(m, move));
  const next = makeMove(pos, move);
  if (right) {
    if (kind === 'mate2' && step === 0) return { ok: true, reply: toughestReply(next)! };
    return { ok: true };
  }
  const mate = matingMoves(next)[0];
  if (mate) return { ok: false, why: 'allowsMate', reply: mate };
  const win = winsMaterial(next) ?? undefined;
  switch (kind) {
    case 'free':
      return worth(pos, move) > 0
        ? { ok: false, why: 'guarded', reply: win }
        : { ok: false, why: 'noCapture' };
    case 'save':
      if (isStalemate(next)) return { ok: false, why: 'stalemate' };
      return { ok: false, why: 'stillDanger', reply: win };
    case 'fork':
      return { ok: false, why: 'notFork', reply: win };
    case 'mate2': {
      if (isStalemate(next)) return { ok: false, why: 'stalemate' };
      if (step === 1) {
        const escape = legalMoves(next)[0];
        return { ok: false, why: 'notMate', reply: escape };
      }
      // An answer after which there is no mate in one, to show the way out.
      const escape = legalMoves(next).find((r) => matingMoves(makeMove(next, r)).length === 0);
      return { ok: false, why: isCheckmate(next) ? 'notMate' : 'notForced', reply: escape };
    }
  }
}

/** What makes a position a fair puzzle of its kind. Used by the generator and checked again by a test. */
export function isFairPuzzle(kind: SkillKind, pos: Position): boolean {
  if (pos.turn !== 'w' || inCheck(pos.board, 'w') || inCheck(pos.board, 'b')) return false;
  const moves = legalMoves(pos);
  if (moves.some((m) => m.promotion)) return false;
  // A mate in one would be a better answer than the one asked for.
  if (matingMoves(pos).length > 0) return false;
  switch (kind) {
    case 'free': {
      const free = freeCaptures(pos);
      // Exactly one thing to win, and at least one other piece that looks takeable but is guarded.
      if (free.length !== 1 || moves.filter((m) => netGain(pos, m) > 0 && worth(pos, m) > 0).length !== 1)
        return false;
      if (!moves.some((m) => worth(pos, m) > 0 && netGain(pos, m) < 0)) return false;
      const after = makeMove(pos, free[0]!);
      return winsMaterial(after) === null && matingMoves(after).length === 0 && !isStalemate(after);
    }
    case 'save': {
      const danger = threatenedSquares(pos, 'w');
      if (danger.length !== 1 || (lossesAt(pos, 'w').get(danger[0]!) ?? 0) < BIG) return false;
      if (winsMaterial(pos) !== null) return false;
      const saving = savingMoves(pos);
      return saving.length >= 1 && saving.length <= 6;
    }
    case 'fork':
      return (
        winsMaterial(pos) === null &&
        threatenedSquares(pos, 'w').length === 0 &&
        winningForks(pos).length === 1
      );
    case 'mate2':
      return mateInTwoKeys(pos).length === 1;
  }
}
