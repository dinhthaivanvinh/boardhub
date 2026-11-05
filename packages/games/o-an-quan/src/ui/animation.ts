import { isQuanSquare, quanIndex, sow, type SowEvent } from '../rules/rules';
import type { OAnQuanMove, OAnQuanSeat, OAnQuanState } from '../rules/types';

/** What the board shows at one moment of a move being played out. */
export interface Frame {
  cells: number[];
  quan: [boolean, boolean];
  stash: { dan: number; quan: number }[];
  /** Stones still in the player's hand. */
  hand: number;
  /** The square being picked up, sown into or captured. */
  active: number;
  event: SowEvent['kind'];
  /** Squares captured so far in this move. */
  taken: number[];
  /** The square the move started from. */
  start: number;
}

/** The move replayed step by step from the position before it. */
export function sowFrames(before: OAnQuanState, move: OAnQuanMove): Frame[] {
  const seat: OAnQuanSeat = before.turn;
  const { events } = sow(before, seat, move);
  const cells = before.cells.slice();
  const quan: [boolean, boolean] = [before.quan[0], before.quan[1]];
  const stash = before.stash.map((x) => ({ ...x }));
  const taken: number[] = [];
  let hand = 0;
  return events.map((e) => {
    if (e.kind === 'pick') {
      hand = e.count;
      cells[e.cell] = 0;
    } else if (e.kind === 'drop') {
      cells[e.cell]!++;
      hand--;
    } else {
      cells[e.cell] = 0;
      stash[seat]!.dan += e.dan;
      if (e.quan && isQuanSquare(e.cell)) {
        quan[quanIndex(e.cell)] = false;
        stash[seat]!.quan++;
      }
      taken.push(e.cell);
    }
    return {
      cells: cells.slice(),
      quan: [quan[0], quan[1]],
      stash: stash.map((x) => ({ ...x })),
      hand,
      active: e.cell,
      event: e.kind,
      taken: taken.slice(),
      start: move.cell,
    };
  });
}

/**
 * How long each frame stays on screen. Slow enough to follow every stone, but a very long move
 * (many pick-ups) speeds up so it never takes more than about 12 seconds.
 */
export function frameDelay(frame: Frame, totalFrames: number): number {
  const base = frame.event === 'drop' ? 380 : frame.event === 'pick' ? 550 : 700;
  const scale = Math.min(1, 12_000 / (totalFrames * 420));
  return Math.max(90, Math.round(base * scale));
}
