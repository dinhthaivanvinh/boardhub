import { createRng, type Rng, type Viewer } from '@bg/engine';
import { randomPlacement } from '../src/bot';
import { buildFleet, STOCK_LAYOUTS } from '../src/rules/fleet';
import { applyMove, setup } from '../src/rules/rules';
import type { BanTauMove, BanTauState, Placement, Ship } from '../src/rules/types';

export const ctx = { rng: undefined as never };
/** Cell from column letter index and 1-based row, e.g. at(2, 7) = C7. */
export const at = (col: number, row: number) => (row - 1) * 10 + col;

export const play = (s: BanTauState, seat: number, move: BanTauMove) => applyMove(s, seat, move);

/** Both fleets placed (stock layouts 0 and 1 by default), seat 0 to fire. */
export function battle(a: Placement[] = STOCK_LAYOUTS[0]!, b: Placement[] = STOCK_LAYOUTS[1]!): BanTauState {
  let s = setup({});
  s = play(s, 0, { kind: 'place', ships: a });
  s = play(s, 1, { kind: 'place', ships: b });
  return s;
}

/** Fires every cell of the given cells in order as `seat`, ignoring turn order (for building positions). */
export function fireAll(s: BanTauState, seat: number, cells: number[]): BanTauState {
  for (const cell of cells) s = { ...play({ ...s, turn: seat === 0 ? 0 : 1 }, seat, { kind: 'fire', cell }) };
  return s;
}

/**
 * Rule E10 helper: re-draw at random everything `viewer` may not see, i.e. the ships of the other side
 * that are not sunk (both sides for a spectator). Sunk ships and every shot stay as they are.
 */
export function resampleHidden(state: BanTauState, viewer: Viewer, rng: Rng): BanTauState {
  if (state.phase === 'over') return state;
  const fleets: BanTauState['fleets'] = [state.fleets[0], state.fleets[1]];
  for (const seat of [0, 1] as const) {
    if (viewer === seat || !fleets[seat]) continue;
    const keep = fleets[seat].filter((s) => state.sunk[seat].includes(s.id));
    fleets[seat] = redraw(keep, rng);
  }
  return { ...state, fleets };
}

function redraw(keep: Ship[], rng: Rng): Ship[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const fleet = buildFleet(randomPlacement(rng, false));
    if (!fleet.ok) continue;
    const kept = new Set(keep.flatMap((s) => s.cells));
    const ships = fleet.ships.map((s) => keep.find((k) => k.id === s.id) ?? s);
    const fresh = ships.filter((s) => !keep.some((k) => k.id === s.id));
    if (fresh.some((s) => s.cells.some((c) => kept.has(c)))) continue;
    return ships;
  }
  return keep;
}

export const rngOf = (seed: string): Rng => createRng(seed, 0);
