import type { Seat } from '@bg/engine';
import { countDiscs, legalCells } from '../rules/board';
import type { ReversiMove, ReversiSeat, ReversiState } from '../rules/types';

const weightCache = new Map<number, Int16Array>();

/** Classic positional weights, generalised to any even size: corners great, cells next to corners bad, edges good. */
export function weightsFor(size: number): Int16Array {
  const cached = weightCache.get(size);
  if (cached) return cached;
  const w = new Int16Array(size * size);
  const last = size - 1;
  const edge = (i: number) => i === 0 || i === last;
  const nearEdge = (i: number) => i === 1 || i === last - 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let v = 1;
      if (edge(r) && edge(c))
        v = 100; // corner
      else if (nearEdge(r) && nearEdge(c))
        v = -50; // X-square, diagonal to a corner
      else if ((edge(r) && nearEdge(c)) || (nearEdge(r) && edge(c)))
        v = -20; // C-square
      else if (edge(r) || edge(c)) v = 10;
      else if (nearEdge(r) || nearEdge(c)) v = -2;
      w[r * size + c] = v;
    }
  }
  weightCache.set(size, w);
  return w;
}

export function evaluate(s: ReversiState, seat: Seat): number {
  const me: ReversiSeat = seat === 0 ? 0 : 1;
  const opp: ReversiSeat = me === 0 ? 1 : 0;
  const { size } = s.config;
  const [black, white] = countDiscs(s.board);
  const empty = s.board.length - black - white;
  const discDiff = me === 0 ? black - white : white - black;
  // Near the end only the final count matters.
  if (empty <= 10) return discDiff * 10;

  const w = weightsFor(size);
  let positional = 0;
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === me) positional += w[i] as number;
    else if (s.board[i] === opp) positional -= w[i] as number;
  }
  const mobility = legalCells(s.board, size, me).length - legalCells(s.board, size, opp).length;
  return positional + mobility * 5;
}

/** Best squares first (corners, then edges), so alpha-beta prunes well. */
export function orderMoves(s: ReversiState, moves: ReversiMove[]): ReversiMove[] {
  const w = weightsFor(s.config.size);
  return moves.slice().sort((a, b) => (w[b.cell] as number) - (w[a.cell] as number) || a.cell - b.cell);
}
