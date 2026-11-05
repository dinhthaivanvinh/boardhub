import { z } from 'zod';
import type { GameResult, MoveCheck, Seat, Viewer } from '@bg/engine';
import { buildFleet, CELLS, isSunk, shipAt, STOCK_LAYOUTS } from './fleet';
import type { BanTauConfig, BanTauMove, BanTauSeat, BanTauState, BanTauView, Ship } from './types';

export const configSchema = z.strictObject({}) as z.ZodType<BanTauConfig>;
export const moveSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('place'),
    ships: z.array(z.strictObject({ cell: z.number().int(), horizontal: z.boolean() })).max(10),
  }),
  z.strictObject({ kind: z.literal('fire'), cell: z.number().int() }),
]);

const seatOf = (seat: Seat): BanTauSeat => (seat === 0 ? 0 : 1);
const other = (s: BanTauSeat): BanTauSeat => (s === 0 ? 1 : 0);

export function setup(config: BanTauConfig): BanTauState {
  return {
    config,
    phase: 'placing',
    turn: 0,
    fleets: [null, null],
    shots: [[], []],
    sunk: [[], []],
    lastShot: null,
    moveCount: 0,
    winner: null,
  };
}

export function validateMove(s: BanTauState, seat: Seat, m: BanTauMove): MoveCheck {
  const me = seatOf(seat);
  if (m.kind === 'place') {
    if (s.phase !== 'placing' || s.fleets[me]) return { ok: false, code: 'ban-tau.wrong_phase' };
    const fleet = buildFleet(m.ships);
    return fleet.ok ? { ok: true } : { ok: false, code: `ban-tau.${fleet.code}` };
  }
  if (s.phase !== 'battle') return { ok: false, code: 'ban-tau.wrong_phase' };
  if (m.cell < 0 || m.cell >= CELLS) return { ok: false, code: 'ban-tau.out_of_bounds' };
  if (s.shots[me].some((shot) => shot.cell === m.cell)) return { ok: false, code: 'ban-tau.already_shot' };
  return { ok: true };
}

export function applyMove(s: BanTauState, seat: Seat, m: BanTauMove): BanTauState {
  const me = seatOf(seat);
  if (m.kind === 'place') {
    const fleet = buildFleet(m.ships);
    if (!fleet.ok) return s; // validateMove rejects this first
    const fleets: BanTauState['fleets'] = [s.fleets[0], s.fleets[1]];
    fleets[me] = fleet.ships;
    const bothPlaced = fleets[0] !== null && fleets[1] !== null;
    return {
      ...s,
      fleets,
      phase: bothPlaced ? 'battle' : 'placing',
      // Seat 1 places after seat 0; then seat 0 fires first.
      turn: bothPlaced ? 0 : other(me),
      moveCount: s.moveCount + 1,
    };
  }

  const target = other(me);
  const ships = s.fleets[target] ?? [];
  const ship = shipAt(ships, m.cell);
  const hit = ship !== undefined;
  const myShots = [...s.shots[me], { cell: m.cell, hit }];
  const shots: BanTauState['shots'] = me === 0 ? [myShots, s.shots[1]] : [s.shots[0], myShots];
  const sunkNow = ship && isSunk(ship, myShots) ? ship.id : null;
  const sunkList = sunkNow === null ? s.sunk[target] : [...s.sunk[target], sunkNow];
  const sunk: BanTauState['sunk'] = target === 0 ? [sunkList, s.sunk[1]] : [s.sunk[0], sunkList];
  const allSunk = sunkList.length === ships.length && ships.length > 0;
  return {
    ...s,
    shots,
    sunk,
    // A hit earns another shot.
    turn: hit ? me : target,
    phase: allSunk ? 'over' : 'battle',
    winner: allSunk ? me : null,
    lastShot: { seat: me, cell: m.cell, hit, sunk: sunkNow },
    moveCount: s.moveCount + 1,
  };
}

export function legalMoves(s: BanTauState, seat: Seat): BanTauMove[] {
  const me = seatOf(seat);
  if (s.phase === 'placing') {
    return s.fleets[me] ? [] : STOCK_LAYOUTS.map((ships) => ({ kind: 'place' as const, ships }));
  }
  if (s.phase !== 'battle') return [];
  const shot = new Set(s.shots[me].map((x) => x.cell));
  const moves: BanTauMove[] = [];
  for (let cell = 0; cell < CELLS; cell++) if (!shot.has(cell)) moves.push({ kind: 'fire', cell });
  return moves;
}

export function result(s: BanTauState): GameResult | null {
  if (s.phase !== 'over' || s.winner === null) return null;
  return { kind: 'win', winners: [s.winner], reason: 'fleet_sunk' };
}

/** Rule E10: your own ships, the opponent's sunk ships, every shot. Everything once the game is over. */
export function playerView(s: BanTauState, viewer: Viewer): BanTauView {
  const visible = (seat: BanTauSeat): Ship[] => {
    const ships = s.fleets[seat] ?? [];
    if (s.phase === 'over' || viewer === seat) return ships;
    return ships.filter((ship) => s.sunk[seat].includes(ship.id));
  };
  return {
    config: s.config,
    phase: s.phase,
    turn: s.turn,
    fleets: [visible(0), visible(1)],
    placed: [s.fleets[0] !== null, s.fleets[1] !== null],
    shots: s.shots,
    sunk: s.sunk,
    lastShot: s.lastShot,
    moveCount: s.moveCount,
    winner: s.winner,
  };
}
