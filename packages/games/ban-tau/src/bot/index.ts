import type { Bot, BotLevel } from '@bg/bots';
import type { Rng } from '@bg/engine';
import { around, CELLS, colOf, FLEET, rowOf, shipCells, SIZE } from '../rules/fleet';
import type { BanTauMove, BanTauSeat, BanTauView, Placement } from '../rules/types';

/** Random fleet; `spread` keeps ships from touching (harder to find). Always succeeds: falls back to rows. */
export function randomPlacement(rng: Rng, spread: boolean): Placement[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const used = new Set<number>();
    const blocked = new Set<number>();
    const out: Placement[] = [];
    for (const size of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        const horizontal = rng.next() < 0.5;
        const cell = rng.int(0, CELLS);
        const cells = shipCells(cell, size, horizontal);
        if (!cells || cells.some((c) => used.has(c) || (spread && blocked.has(c)))) continue;
        for (const c of cells) {
          used.add(c);
          for (const n of around(c)) blocked.add(n);
        }
        out.push({ cell, horizontal });
        placed = true;
      }
      if (!placed) break;
    }
    if (out.length === FLEET.length) return out;
  }
  return FLEET.map((_, i) => ({ cell: i * 2 * SIZE, horizontal: true }));
}

export interface Knowledge {
  shot: Set<number>;
  misses: Set<number>;
  /** Hits on ships that are not sunk yet. */
  openHits: number[];
  /** Cells of sunk ships (no other ship can be there). */
  sunkCells: Set<number>;
  /** Sizes of the ships still afloat. */
  remaining: number[];
}

function knowledge(view: BanTauView, me: BanTauSeat): Knowledge {
  const them: BanTauSeat = me === 0 ? 1 : 0;
  const shots = view.shots[me];
  const sunkShips = view.fleets[them].filter((s) => view.sunk[them].includes(s.id));
  const sunkCells = new Set(sunkShips.flatMap((s) => s.cells));
  const remaining = FLEET.filter((_, id) => !view.sunk[them].includes(id));
  return {
    shot: new Set(shots.map((s) => s.cell)),
    misses: new Set(shots.filter((s) => !s.hit).map((s) => s.cell)),
    openHits: shots.filter((s) => s.hit && !sunkCells.has(s.cell)).map((s) => s.cell),
    sunkCells,
    remaining: [...remaining],
  };
}

/**
 * How likely each cell is to hold a ship: every way to place each remaining ship that fits the misses and
 * sunk ships counts once; ways that pass through open hits count far more (that is where a ship must be).
 */
export function heatMap(k: Knowledge): number[] {
  const heat = Array.from({ length: CELLS }, () => 0);
  const open = new Set(k.openHits);
  for (const size of k.remaining) {
    for (let cell = 0; cell < CELLS; cell++) {
      for (const horizontal of [true, false]) {
        const cells = shipCells(cell, size, horizontal);
        if (!cells || cells.some((c) => k.misses.has(c) || k.sunkCells.has(c))) continue;
        const covered = cells.filter((c) => open.has(c)).length;
        if (open.size > 0 && covered === 0) continue; // hunting a wounded ship comes first
        const weight = covered === 0 ? 1 : 50 ** covered;
        for (const c of cells) if (!k.shot.has(c)) heat[c]! += weight;
      }
    }
  }
  return heat;
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(0, items.length)]!;

/** Unshot cells next to open hits, preferring the line the hits already form. */
function targetCells(k: Knowledge): number[] {
  const near = (cell: number) =>
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]
      .map(([dr, dc]) => [rowOf(cell) + dr!, colOf(cell) + dc!] as const)
      .filter(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
      .map(([r, c]) => r * SIZE + c)
      .filter((c) => !k.shot.has(c));
  const all = [...new Set(k.openHits.flatMap(near))];
  if (k.openHits.length >= 2) {
    const sameRow = k.openHits.every((c) => rowOf(c) === rowOf(k.openHits[0]!));
    const sameCol = k.openHits.every((c) => colOf(c) === colOf(k.openHits[0]!));
    const inLine = all.filter((c) =>
      sameRow ? rowOf(c) === rowOf(k.openHits[0]!) : sameCol ? colOf(c) === colOf(k.openHits[0]!) : false,
    );
    if (inLine.length > 0) return inLine;
  }
  return all;
}

function fire(view: BanTauView, me: BanTauSeat, level: BotLevel, rng: Rng): number {
  const k = knowledge(view, me);
  const free = Array.from({ length: CELLS }, (_, c) => c).filter((c) => !k.shot.has(c));
  if (level === 'easy') {
    const targets = targetCells(k);
    return targets.length > 0 && rng.next() < 0.5 ? pick(rng, targets) : pick(rng, free);
  }
  if (level === 'medium') {
    const targets = targetCells(k);
    if (targets.length > 0) return pick(rng, targets);
    // Every ship covers at least two cells, so a checkerboard finds them all.
    const parity = free.filter((c) => (rowOf(c) + colOf(c)) % 2 === 0);
    return pick(rng, parity.length > 0 ? parity : free);
  }
  const heat = heatMap(k);
  let best = -1;
  for (const c of free) best = Math.max(best, heat[c]!);
  const top = free.filter((c) => heat[c] === best);
  return pick(rng, top.length > 0 ? top : free);
}

/** Plays from its own playerView only (rule B4): it never sees ships that are not sunk. */
export const bot: Bot<BanTauView, BanTauMove> = {
  id: 'ban-tau.default',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ state: view, seat, level, rng }) {
    const me: BanTauSeat = seat === 0 ? 0 : 1;
    if (view.phase === 'placing') return { kind: 'place', ships: randomPlacement(rng, level === 'hard') };
    return { kind: 'fire', cell: fire(view, me, level, rng) };
  },
};
