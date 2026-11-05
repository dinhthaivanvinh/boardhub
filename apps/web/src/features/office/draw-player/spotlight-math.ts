import { createRng } from '@bg/engine';
import { DRAW_BUILD_UP_MS, DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord } from '@bg/protocol';
import { easeInOut } from './timeline';

/**
 * Đèn sân khấu (docs/office/07 §3): a light hops from animal to animal, faster and faster, then slows down
 * and stops on the winner. A position is "between cell a and cell b, fraction f" so screens can map it
 * onto their own layout.
 */
export interface Spot {
  a: number;
  b: number;
  f: number;
}

const HOP_SLOW = 340;
const HOP_FAST = 90;
const LANDING_HOPS = 9;

/** Start time of each hop during the build-up: the interval shrinks from HOP_SLOW to HOP_FAST. */
const BUILD_HOPS: number[] = (() => {
  const ts = [0];
  let t = 0;
  while (t < DRAW_BUILD_UP_MS) {
    t += HOP_SLOW + (HOP_FAST - HOP_SLOW) * (t / DRAW_BUILD_UP_MS);
    ts.push(t);
  }
  return ts;
})();

/** The cell the light goes to on hop `j` of the build-up: random, but never the same cell twice in a row. */
function buildCell(drawId: string, count: number, j: number): number {
  const raw = (k: number) => createRng(`${drawId}:spot:${k}`, 0).int(0, count);
  const here = raw(j);
  return j > 0 && here === raw(j - 1) ? (here + 1) % count : here;
}

export function buildUpSpot(drawId: string, count: number, t: number): Spot {
  if (count <= 1) return { a: 0, b: 0, f: 1 };
  const last = BUILD_HOPS[BUILD_HOPS.length - 1]!;
  let i: number;
  let start: number;
  let dur: number;
  if (t < last) {
    i = 0;
    while (BUILD_HOPS[i + 1]! <= t) i++;
    start = BUILD_HOPS[i]!;
    dur = BUILD_HOPS[i + 1]! - start;
  } else {
    // A late reveal: keep hopping at full speed.
    const k = Math.floor((t - last) / HOP_FAST);
    i = BUILD_HOPS.length - 1 + k;
    start = last + k * HOP_FAST;
    dur = HOP_FAST;
  }
  return {
    a: buildCell(drawId, count, i),
    b: buildCell(drawId, count, i + 1),
    f: easeInOut((t - Math.max(0, start)) / dur),
  };
}

/** Landing hop durations: each a bit longer than the last, together 85% of the landing. */
const LANDING_DURS: number[] = (() => {
  const raw = Array.from({ length: LANDING_HOPS + 1 }, (_, j) => 1.3 ** j);
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map((x) => (x / sum) * DRAW_LANDING_MS * 0.85);
})();

/** Landing: finish the hop in progress, a few slower hops (from the seed), the last one onto the winner. */
export function landingSpot(record: OfficeDrawRecord, count: number, t: number): Spot {
  const target = record.candidates.findIndex((c) => c.id === record.winners[0]);
  if (count <= 1) return { a: target, b: target, f: 1 };
  const from = buildUpSpot(record.drawId, count, DRAW_BUILD_UP_MS);
  const rng = createRng(`${record.seed}:spotlight`, 0);
  const cells = [from.b];
  for (let j = 1; j < LANDING_HOPS; j++) {
    let c = rng.int(0, count);
    if (c === cells[j - 1]) c = (c + 1) % count;
    cells.push(c);
  }
  cells.push(target);

  let start = 0;
  for (let j = 0; j < cells.length; j++) {
    const dur = LANDING_DURS[j]!;
    if (t < start + dur) {
      const x = easeInOut((t - start) / dur);
      return j === 0
        ? { a: from.a, b: from.b, f: from.f + (1 - from.f) * x }
        : { a: cells[j - 1]!, b: cells[j]!, f: x };
    }
    start += dur;
  }
  return { a: target, b: target, f: 1 };
}
