/** "Mã nhặt sao": visit every star with the knight, never stopping where a black pawn watches. */
import { squareOf } from '../rules/board';
import type { ChessMove } from '../rules/types';
import { boardWith, knightSquares, type MiniBoard, pawnAttacks } from './common';

export type KnightLevel = { knight: string; stars: string[]; pawns: string[] };

export const KNIGHT_LEVELS: readonly KnightLevel[] = [
  { knight: 'b1', stars: ['c3'], pawns: [] },
  { knight: 'b1', stars: ['c3', 'e4'], pawns: [] },
  { knight: 'a1', stars: ['b3', 'd4', 'f5'], pawns: [] },
  { knight: 'd4', stars: ['b5', 'f5', 'e2', 'c2'], pawns: [] },
  { knight: 'b1', stars: ['d5', 'f6'], pawns: ['c4', 'e5'] },
  { knight: 'g1', stars: ['e5', 'c6', 'g6'], pawns: ['d5', 'f4', 'e7'] },
  { knight: 'b1', stars: ['b6', 'g7', 'g2', 'd4', 'e6'], pawns: ['c4', 'f5', 'e3'] },
  { knight: 'a1', stars: ['a8', 'h8', 'h1', 'd5', 'e4'], pawns: [] },
];

export const knightBoard = (level: KnightLevel): MiniBoard =>
  boardWith({ wN: [level.knight], bP: level.pawns });

/** The squares a black pawn watches: the knight may not stop there. */
export const watched = (board: MiniBoard): Set<number> =>
  new Set(board.flatMap((p, s) => (p === 'bP' ? pawnAttacks(s, 'b') : [])));

export const knightPosition = (board: MiniBoard): number => board.indexOf('wN');

/** Where the knight can go: its usual squares, without pawns and the squares they watch. */
export function knightTargets(board: MiniBoard): number[] {
  const danger = watched(board);
  return knightSquares(knightPosition(board)).filter((s) => !board[s] && !danger.has(s));
}

/** The shortest way from here to having visited all the stars left: its moves, or null if there is none. */
export function knightSolution(board: MiniBoard, starsLeft: readonly number[]): ChessMove[] | null {
  const danger = watched(board);
  const blocked = (s: number) => board[s] === 'bP' || danger.has(s);
  const full = (1 << starsLeft.length) - 1;
  type Node = { square: number; got: number; path: ChessMove[] };
  const start: Node = { square: knightPosition(board), got: 0, path: [] };
  if (full === 0) return [];
  const seen = new Set([`${start.square}:0`]);
  let queue: Node[] = [start];
  while (queue.length > 0) {
    const next: Node[] = [];
    for (const node of queue) {
      for (const to of knightSquares(node.square)) {
        if (blocked(to)) continue;
        const star = starsLeft.indexOf(to);
        const got = star >= 0 ? node.got | (1 << star) : node.got;
        const path = [...node.path, { from: node.square, to }];
        if (got === full) return path;
        const key = `${to}:${got}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ square: to, got, path });
      }
    }
    queue = next;
  }
  return null;
}

/** The fewest moves a level can be done in. */
export const knightPar = (level: KnightLevel): number =>
  knightSolution(knightBoard(level), level.stars.map(squareOf))!.length;
