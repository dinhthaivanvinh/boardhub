import { createBot } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { definition } from '../rules/definition';
import type { ChessMove, ChessState, PieceType } from '../rules/types';

export const PIECE_VALUE: Record<PieceType, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

// Piece-square tables (Tomasz Michniewski's simplified evaluation), from White's side:
// index 0 is a8, index 63 is h1, the same layout as the board.
// prettier-ignore
const PST: Record<PieceType, number[]> = {
  P: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  N: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  B: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  R: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  Q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  K: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

/** Material and piece placement for `seat`, minus the opponent's. Black reads the tables upside down. */
export function evaluate(s: ChessState, seat: Seat): number {
  const me = seat === 0 ? 'w' : 'b';
  let total = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq];
    if (!p) continue;
    const type = p[1] as PieceType;
    const index = p[0] === 'w' ? sq : (7 - (sq >> 3)) * 8 + (sq & 7);
    const v = PIECE_VALUE[type] + PST[type][index]!;
    total += p[0] === me ? v : -v;
  }
  if (s.inCheck !== null) total += s.inCheck === seat ? -30 : 30;
  return total;
}

/** Valuable captures by cheap pieces first (MVV-LVA), then promotions, then quiet moves. */
export function orderMoves(s: ChessState, moves: ChessMove[]): ChessMove[] {
  const score = (m: ChessMove) => {
    const victim = s.board[m.to];
    const attacker = s.board[m.from];
    let v = 0;
    if (victim)
      v +=
        10 * PIECE_VALUE[victim[1] as PieceType] -
        (attacker ? PIECE_VALUE[attacker[1] as PieceType] : 0) +
        10_000;
    if (m.promotion) v += PIECE_VALUE[m.promotion] + 5_000;
    return v;
  };
  return moves
    .map((m) => ({ m, v: score(m) }))
    .sort((a, b) => b.v - a.v || a.m.from - b.m.from || a.m.to - b.m.to)
    .map((x) => x.m);
}

export const bot = createBot({
  id: 'chess.default',
  def: definition,
  evaluate,
  orderMoves,
  levels: {
    easy: { algo: 'greedy', timeMs: 300, noise: 0.3 },
    medium: { algo: 'minimax', timeMs: 1000, maxDepth: 3 },
    hard: { algo: 'minimax', timeMs: 2500, maxDepth: 5, maxBranching: 24 },
  },
});
