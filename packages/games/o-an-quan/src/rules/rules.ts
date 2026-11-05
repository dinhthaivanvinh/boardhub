import { z } from 'zod';
import type { GameResult, MoveCheck, Seat } from '@bg/engine';
import type { OAnQuanConfig, OAnQuanMove, OAnQuanSeat, OAnQuanState } from './types';

export const configSchema = z.strictObject({}) as z.ZodType<OAnQuanConfig>;
export const moveSchema = z.strictObject({
  cell: z.number().int(),
  dir: z.union([z.literal(1), z.literal(-1)]),
});

export const RING = 12;
export const QUAN_VALUE = 10;
/** The game is scored after this many moves (it never gets near in practice). */
export const MOVE_LIMIT = 200;
/** Safety net for a single turn's sowing. */
const MAX_SOWN = 600;

export const isQuanSquare = (i: number) => i === 0 || i === 6;
export const quanIndex = (i: number): 0 | 1 => (i === 0 ? 0 : 1);
export const ownSquares = (seat: OAnQuanSeat): number[] => (seat === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11]);
export const ownerOf = (i: number): OAnQuanSeat | null =>
  i >= 1 && i <= 5 ? 0 : i >= 7 && i <= 11 ? 1 : null;
const other = (s: OAnQuanSeat): OAnQuanSeat => (s === 0 ? 1 : 0);
const step = (i: number, dir: 1 | -1) => (i + dir + RING) % RING;
const seatOf = (seat: Seat): OAnQuanSeat => (seat === 0 ? 0 : 1);

export function setup(config: OAnQuanConfig): OAnQuanState {
  return {
    config,
    cells: [0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5],
    quan: [true, true],
    stash: [
      { dan: 0, quan: 0 },
      { dan: 0, quan: 0 },
    ],
    debt: [0, 0],
    turn: 0,
    moveCount: 0,
    lastMove: null,
    sown: [],
    taken: [],
    refill: null,
    ended: null,
  };
}

/** Points each seat would have if the game were scored now. */
export function scores(s: OAnQuanState): [number, number] {
  const score = (seat: OAnQuanSeat) =>
    s.stash[seat]!.dan +
    QUAN_VALUE * s.stash[seat]!.quan +
    ownSquares(seat).reduce((n, i) => n + s.cells[i]!, 0) -
    s.debt[seat] +
    s.debt[other(seat)];
  return [score(0), score(1)];
}

export function validateMove(s: OAnQuanState, seat: Seat, m: OAnQuanMove): MoveCheck {
  if (ownerOf(m.cell) !== seatOf(seat)) return { ok: false, code: 'o-an-quan.not_your_cell' };
  if (s.cells[m.cell] === 0) return { ok: false, code: 'o-an-quan.empty_cell' };
  return { ok: true };
}

/** One step of a move, in order. The board replays these to show the sowing stone by stone. */
export type SowEvent =
  | { kind: 'pick'; cell: number; count: number }
  | { kind: 'drop'; cell: number }
  | { kind: 'take'; cell: number; dan: number; quan: boolean };

/** Sowing and capturing for one move. Pure: returns new arrays. */
export function sow(s: OAnQuanState, seat: OAnQuanSeat, m: OAnQuanMove) {
  const cells = s.cells.slice();
  const quan: [boolean, boolean] = [s.quan[0], s.quan[1]];
  const stash = s.stash.map((x) => ({ ...x }));
  const sown: number[] = [];
  const taken: number[] = [];
  const events: SowEvent[] = [];
  const hasStones = (i: number) => cells[i]! > 0 || (isQuanSquare(i) && quan[quanIndex(i)]);

  let pos = m.cell;
  let hand = cells[pos]!;
  cells[pos] = 0;
  events.push({ kind: 'pick', cell: pos, count: hand });
  for (;;) {
    while (hand > 0 && sown.length < MAX_SOWN) {
      pos = step(pos, m.dir);
      cells[pos]!++;
      hand--;
      sown.push(pos);
      events.push({ kind: 'drop', cell: pos });
    }
    if (hand > 0) {
      // Never happens in real play: put the rest back where we stand and stop.
      cells[pos]! += hand;
      break;
    }
    const next = step(pos, m.dir);
    if (isQuanSquare(next) && hasStones(next)) break; // a quan square stops the turn
    if (!isQuanSquare(next) && cells[next]! > 0) {
      // Pick up the next square and keep sowing.
      hand = cells[next]!;
      cells[next] = 0;
      pos = next;
      events.push({ kind: 'pick', cell: pos, count: hand });
      continue;
    }
    // An empty square: capture what lies beyond it, again and again while "empty, full" repeats.
    let empty = next;
    for (;;) {
      const target = step(empty, m.dir);
      if (!hasStones(target)) break;
      const withQuan = isQuanSquare(target) && quan[quanIndex(target)];
      events.push({ kind: 'take', cell: target, dan: cells[target]!, quan: withQuan });
      stash[seat]!.dan += cells[target]!;
      cells[target] = 0;
      if (isQuanSquare(target) && quan[quanIndex(target)]) {
        quan[quanIndex(target)] = false;
        stash[seat]!.quan++;
      }
      taken.push(target);
      const after = step(target, m.dir);
      if (hasStones(after)) break;
      empty = after;
    }
    break;
  }
  return { cells, quan, stash, sown, taken, events };
}

export function applyMove(s: OAnQuanState, seat: Seat, m: OAnQuanMove): OAnQuanState {
  const me = seatOf(seat);
  const next = other(me);
  const { cells, quan, stash, sown, taken } = sow(s, me, m);
  const debt: [number, number] = [s.debt[0], s.debt[1]];
  const moveCount = s.moveCount + 1;

  let ended: OAnQuanState['ended'] = null;
  let refill: OAnQuanState['refill'] = null;
  if (!quan[0] && !quan[1]) ended = 'quan_taken';
  else if (moveCount >= MOVE_LIMIT) ended = 'move_limit';
  else if (ownSquares(next).every((i) => cells[i] === 0)) {
    // Out of dân: put 5 of your captured dân back, borrowing from the opponent if needed.
    const own = Math.min(5, stash[next]!.dan);
    const borrowed = 5 - own;
    if (stash[me]!.dan < borrowed) {
      ended = 'no_stones';
    } else {
      stash[next]!.dan -= own;
      stash[me]!.dan -= borrowed;
      debt[next] += borrowed;
      for (const i of ownSquares(next)) cells[i] = 1;
      refill = { seat: next, borrowed };
    }
  }
  return {
    ...s,
    cells,
    quan,
    stash,
    debt,
    turn: next,
    moveCount,
    lastMove: m,
    sown,
    taken,
    refill,
    ended,
  };
}

export function legalMoves(s: OAnQuanState, seat: Seat): OAnQuanMove[] {
  if (s.ended) return [];
  return ownSquares(seatOf(seat))
    .filter((i) => s.cells[i]! > 0)
    .flatMap((cell) => [
      { cell, dir: -1 as const },
      { cell, dir: 1 as const },
    ]);
}

export function result(s: OAnQuanState): GameResult | null {
  if (!s.ended) return null;
  const [a, b] = scores(s);
  if (a === b) return { kind: 'draw', reason: 'equal_points' };
  return { kind: 'win', winners: [a > b ? 0 : 1], reason: 'more_points' };
}
