/**
 * "Xe chặn Tốt": the child has one rook and must take every black pawn before one reaches the first rank. A pawn
 * that can take the rook does. The black side moves one pawn a turn, always the same way for a position.
 */
import { rowOf } from '../rules/board';
import type { ChessMove } from '../rules/types';
import { apply, boardWith, type MiniBoard, pawnMoves, rookSquares, squaresOf } from './common';

export type RookLevel = { rook: string; pawns: string[] };

export const ROOK_LEVELS: readonly RookLevel[] = [
  { rook: 'a1', pawns: ['d6', 'f5'] },
  { rook: 'h1', pawns: ['b6', 'c7', 'f6'] },
  { rook: 'd1', pawns: ['a6', 'd5', 'h7'] },
  { rook: 'e1', pawns: ['b7', 'c6', 'f7', 'g6'] },
  { rook: 'a1', pawns: ['c7', 'd6', 'e7', 'f6', 'g7'] },
];

export const rookBoard = (level: RookLevel): MiniBoard => boardWith({ wR: [level.rook], bP: level.pawns });

export const rookPosition = (board: MiniBoard): number => board.indexOf('wR');
export const rookTargets = (board: MiniBoard): number[] => rookSquares(board, rookPosition(board));

/** The black pawns' answer: take the rook, else queen, else push where the rook cannot take it for free. */
export function pawnsReply(board: MiniBoard): ChessMove | null {
  const moves = squaresOf(board, 'b').flatMap((s) => pawnMoves(board, s));
  if (moves.length === 0) return null;
  const score = (m: ChessMove) => {
    if (board[m.to] === 'wR') return 1_000_000;
    if (rowOf(m.to) === 7) return 100_000;
    const next = apply(board, m);
    const rook = rookPosition(next);
    const taken = rookSquares(next, rook).includes(m.to);
    // Guarded: if the rook takes it, a pawn can take the rook back.
    const guarded =
      taken &&
      squaresOf(apply(next, { from: rook, to: m.to }), 'b').some((s) =>
        pawnMoves(apply(next, { from: rook, to: m.to }), s).some((x) => x.to === m.to),
      );
    return (!taken ? 1_000 : guarded ? 500 : 0) + rowOf(m.to) * 10 - (m.to % 8);
  };
  let best = moves[0]!;
  for (const m of moves) if (score(m) > score(best)) best = m;
  return best;
}

export type RookOutcome = 'won' | 'caught' | 'queened' | null;

export type RookTurn = {
  /** After the child's move. */
  mine: MiniBoard;
  /** After the pawns' answer (the same as `mine` when the game ended or no pawn can move). */
  board: MiniBoard;
  reply: ChessMove | null;
  outcome: RookOutcome;
};

/** The child's move and the answer to it. */
export function rookTurn(board: MiniBoard, move: ChessMove): RookTurn {
  const mine = apply(board, move);
  if (squaresOf(mine, 'b').length === 0) return { mine, board: mine, reply: null, outcome: 'won' };
  const reply = pawnsReply(mine);
  if (!reply) return { mine, board: mine, reply: null, outcome: null };
  const after = apply(mine, reply);
  const outcome: RookOutcome = mine[reply.to] === 'wR' ? 'caught' : rowOf(reply.to) === 7 ? 'queened' : null;
  return { mine, board: after, reply, outcome };
}

/**
 * A way to win from here: the shortest, searched breadth first against the pawns' fixed answers. Null when
 * there is none within `maxStates` positions.
 */
export function rookSolution(board: MiniBoard, maxStates = 40_000): ChessMove[] | null {
  type Node = { board: MiniBoard; path: ChessMove[] };
  const key = (b: MiniBoard) => b.map((p) => (p ? p : '.')).join('');
  const seen = new Set([key(board)]);
  let queue: Node[] = [{ board, path: [] }];
  while (queue.length > 0 && seen.size < maxStates) {
    const next: Node[] = [];
    for (const node of queue) {
      for (const to of rookTargets(node.board)) {
        const move = { from: rookPosition(node.board), to };
        const turn = rookTurn(node.board, move);
        const path = [...node.path, move];
        if (turn.outcome === 'won') return path;
        if (turn.outcome) continue;
        const k = key(turn.board);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ board: turn.board, path });
      }
    }
    queue = next;
  }
  return null;
}
