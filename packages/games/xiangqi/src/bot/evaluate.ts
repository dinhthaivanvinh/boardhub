import type { Seat } from '@bg/engine';
import { applyToBoard, colorOfSeat, COLS, isInCheck, otherColor } from '../rules/board';
import type { Color, PieceType, XiangqiMove, XiangqiState } from '../rules/types';

export const PIECE_VALUE: Record<PieceType, number> = { K: 0, R: 90, C: 45, H: 40, E: 20, A: 20, P: 10 };

function pieceScore(type: PieceType, color: 'r' | 'b', sq: number): number {
  const row = Math.floor(sq / COLS);
  const col = sq % COLS;
  const crossed = color === 'r' ? row <= 4 : row >= 5;
  let v = PIECE_VALUE[type];
  if (type === 'P' && crossed) v += 10 + (col >= 3 && col <= 5 ? 4 : 0);
  // Horses and cannons are worth a little more near the centre files.
  if ((type === 'H' || type === 'C') && col >= 2 && col <= 6) v += 3;
  return v;
}

/** Material and a few positional bonuses for `seat`, minus the opponent's. */
export function evaluate(s: XiangqiState, seat: Seat): number {
  const me = colorOfSeat(seat);
  let total = 0;
  for (let sq = 0; sq < s.board.length; sq++) {
    const p = s.board[sq];
    if (!p) continue;
    const v = pieceScore(p[1] as PieceType, p[0] as 'r' | 'b', sq);
    total += p[0] === me ? v : -v;
  }
  // Being in check is uncomfortable.
  if (s.inCheck !== null) total += s.inCheck === seat ? -15 : 15;
  return total;
}

/**
 * Captures of valuable pieces with cheap pieces first (MVV-LVA), then checks, then quiet moves.
 * Ordering matters a lot here: the search only looks at the first maxBranching moves.
 */
export function orderMoves(s: XiangqiState, moves: XiangqiMove[]): XiangqiMove[] {
  const score = (m: XiangqiMove) => {
    const attacker = s.board[m.from];
    const victim = s.board[m.to];
    if (victim) {
      return (
        PIECE_VALUE[victim[1] as PieceType] * 10 -
        (attacker ? PIECE_VALUE[attacker[1] as PieceType] : 0) +
        1000
      );
    }
    const enemy = otherColor((attacker?.[0] ?? 'r') as Color);
    return isInCheck(applyToBoard(s.board, m), enemy) ? 500 : 0;
  };
  return moves
    .map((m) => ({ m, s: score(m) }))
    .sort((a, b) => b.s - a.s || a.m.from - b.m.from || a.m.to - b.m.to)
    .map((x) => x.m);
}
