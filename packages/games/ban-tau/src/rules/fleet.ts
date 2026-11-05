import type { Placement, Ship, Shot } from './types';

export const SIZE = 10;
export const CELLS = SIZE * SIZE;
/** Ship sizes by id: carrier, battleship, cruiser, submarine, destroyer. */
export const FLEET = [5, 4, 3, 3, 2] as const;

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;

/** Cells of a ship of `size` starting at `cell` (leftmost / topmost), or null if it leaves the sea. */
export function shipCells(cell: number, size: number, horizontal: boolean): number[] | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return null;
  const r = rowOf(cell);
  const c = colOf(cell);
  if (horizontal ? c + size > SIZE : r + size > SIZE) return null;
  return Array.from({ length: size }, (_, i) => (horizontal ? cell + i : cell + i * SIZE));
}

export type FleetCheck =
  { ok: true; ships: Ship[] } | { ok: false; code: 'bad_fleet' | 'out_of_bounds' | 'overlap' };

/** Turns 5 placements into ships, or says what is wrong with them. */
export function buildFleet(placements: readonly Placement[]): FleetCheck {
  if (placements.length !== FLEET.length) return { ok: false, code: 'bad_fleet' };
  const used = new Set<number>();
  const ships: Ship[] = [];
  for (let id = 0; id < FLEET.length; id++) {
    const p = placements[id]!;
    const cells = shipCells(p.cell, FLEET[id]!, p.horizontal);
    if (!cells) return { ok: false, code: 'out_of_bounds' };
    for (const cell of cells) {
      if (used.has(cell)) return { ok: false, code: 'overlap' };
      used.add(cell);
    }
    ships.push({ id, size: FLEET[id]!, cells });
  }
  return { ok: true, ships };
}

/** The ship occupying `cell`, if any. */
export const shipAt = (ships: readonly Ship[], cell: number) => ships.find((s) => s.cells.includes(cell));

/** True when every cell of `ship` has been hit. */
export function isSunk(ship: Ship, shots: readonly Shot[]): boolean {
  return ship.cells.every((cell) => shots.some((s) => s.cell === cell && s.hit));
}

/** Neighbouring cells, diagonals included (used to keep ships apart). */
export function around(cell: number): number[] {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(cell) + dr;
      const c = colOf(cell) + dc;
      if ((dr || dc) && r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
    }
  }
  return out;
}

/** A few fixed, valid layouts. legalMoves offers them so random play and fallbacks can always place. */
export const STOCK_LAYOUTS: readonly Placement[][] = [
  [
    { cell: 0, horizontal: true },
    { cell: 20, horizontal: true },
    { cell: 40, horizontal: true },
    { cell: 60, horizontal: true },
    { cell: 80, horizontal: true },
  ],
  [
    { cell: 9, horizontal: false },
    { cell: 2, horizontal: false },
    { cell: 55, horizontal: true },
    { cell: 77, horizontal: true },
    { cell: 91, horizontal: true },
  ],
  [
    { cell: 11, horizontal: true },
    { cell: 38, horizontal: false },
    { cell: 63, horizontal: false },
    { cell: 45, horizontal: true },
    { cell: 96, horizontal: true },
  ],
];
