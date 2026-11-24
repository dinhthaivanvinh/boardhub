import {
  describe as describeMove,
  inCheck,
  kingSquare,
  legalMoves,
  makeMove,
  pseudoMoves,
} from '../rules/board';
import type { ChessMove, Piece, Position } from '../rules/types';
import { isCheckmate, isStalemate, type MateRound } from './checkmate';
import { PIECE_VALUE } from './capture';

/** The id of the tactics and endgame lesson ("Mẹo nhỏ và tàn cuộc"). */
export const TACTICS_LESSON_ID = 'tactics';

export type ForkRound = { fen: string };
export type PinRound = { fen: string };
export type DrawRound = { fen: string };
export type DrawKind = 'mate' | 'stalemate' | 'ongoing';

/** White to move: find a move after which the moved piece attacks two pieces at once, and cannot be taken. */
export const FORK_ROUNDS: ForkRound[] = [
  { fen: 'k2q3r/8/8/4N3/8/8/8/K7 w - -' }, // knight: queen and rook
  { fen: 'r3k3/8/8/1N6/8/8/8/7K w - -' }, // knight: king and rook, with check
  { fen: '7k/8/3n1n2/8/4P3/8/8/K7 w - -' }, // even a pawn can fork
  { fen: '4k3/8/B7/8/8/3r4/8/K7 w - -' }, // bishop: king and rook
];

/** White to move: tap the white piece that is pinned (it must stay, or the king is attacked). */
export const PIN_ROUNDS: PinRound[] = [
  { fen: '4r2k/8/8/8/8/8/P3N3/4K3 w - -' }, // knight pinned by a rook
  { fen: '7k/8/8/b7/8/8/P2B4/4K3 w - -' }, // bishop pinned by a bishop
  { fen: '7k/8/8/8/8/8/P7/r2Q2K1 w - -' }, // queen pinned by a rook
];

/** White to move and mates in one with two rooks (one cuts off the king, the other gives the check). */
export const LADDER_ROUNDS: MateRound[] = [
  { fen: '4k3/R7/8/8/8/8/8/2K4R w - -' },
  { fen: '7k/1R6/8/8/8/8/8/R5K1 w - -' },
  { fen: '7K/8/8/k7/8/1R6/8/7R w - -' },
];

/** Black to move: is it checkmate, a draw (stalemate), or is the game going on? */
export const DRAW_ROUNDS: DrawRound[] = [
  { fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - -' }, // mate
  { fen: 'k7/8/1Q6/8/8/8/8/K7 b - -' }, // stalemate
  { fen: '4k3/8/8/8/8/8/8/K3R3 b - -' }, // check, but the king can step aside
  { fen: '7k/5Q2/6K1/8/8/8/8/8 b - -' }, // stalemate
  { fen: '4k3/8/8/8/8/8/8/K6R b - -' }, // plenty of moves
];

/** Pieces worth a knight or more, and the king: what a fork is about. */
const isBig = (p: Piece | null) =>
  p !== null && (p[1] === 'K' || PIECE_VALUE[p[1] as keyof typeof PIECE_VALUE] >= 3);

/** Black pieces that the piece on `square` attacks right now (White to look at the position). */
export function attackedFrom(pos: Position, square: number): number[] {
  const asWhite: Position = { ...pos, turn: 'w' };
  const squares = pseudoMoves(asWhite)
    .filter((m) => m.from === square && describeMove(asWhite, m).captured !== null)
    .map((m) => m.to);
  return [...new Set(squares)];
}

/** Moves after which the moved piece attacks two big black pieces and no black move takes it. */
export function forkMoves(pos: Position): ChessMove[] {
  return legalMoves(pos).filter((m) => {
    const after = makeMove(pos, m);
    const targets = attackedFrom(after, m.to).filter((s) => isBig(after.board[s] ?? null));
    if (targets.length < 2) return false;
    return !legalMoves(after).some((reply) => reply.to === m.to);
  });
}

/** The big black pieces a forking move attacks (for showing the two arrows of the fork). */
export const forkTargets = (pos: Position, move: ChessMove): number[] => {
  const after = makeMove(pos, move);
  return attackedFrom(after, move.to).filter((s) => isBig(after.board[s] ?? null));
};

/** White pieces that have moves by the rules of the piece, but fewer (or none) because the king would be attacked. */
export function pinnedSquares(pos: Position): number[] {
  const pseudo = pseudoMoves(pos);
  const legal = legalMoves(pos);
  const out: number[] = [];
  pos.board.forEach((p, s) => {
    if (!p || p[0] !== 'w' || p[1] === 'K') return;
    const before = pseudo.filter((m) => m.from === s).length;
    const after = legal.filter((m) => m.from === s).length;
    if (before > 0 && after < before) out.push(s);
  });
  return out;
}

/** The black pieces that pin the piece on `square`: they would attack the king if it were not in the way. */
export function pinners(pos: Position, square: number): number[] {
  const king = kingSquare(pos.board, 'w');
  const out: number[] = [];
  pos.board.forEach((p, s) => {
    if (!p || p[0] !== 'b' || p[1] === 'K') return;
    // Only this black piece stays, and the pinned piece is lifted off.
    const board = pos.board.map((q, i) => (i === square ? null : i === s || !q || q[0] === 'w' ? q : null));
    if (king >= 0 && inCheck(board, 'w')) out.push(s);
  });
  return out;
}

/** What a position is for the side to move: no move and attacked, no move and safe, or still going. */
export const drawKind = (pos: Position): DrawKind =>
  isCheckmate(pos) ? 'mate' : isStalemate(pos) ? 'stalemate' : 'ongoing';
