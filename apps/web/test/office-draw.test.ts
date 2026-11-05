import { describe, expect, it } from 'vitest';
import { defaultAvatar } from '@bg/avatars';
import { commitment, DRAW_BUILD_UP_MS, DRAW_LANDING_MS, drawWinners } from '@bg/office-core';
import type { OfficeDrawRecord } from '@bg/protocol';
import { buildUpProgress, landingProgress, MAX_LANES, raceLanes } from '../src/features/office/draw-player/race-math';
import { phaseAt } from '../src/features/office/draw-player/timeline';
import { buildUpAngle, landingAngle, segmentAt } from '../src/features/office/draw-player/wheel-math';

const SEED = 'ab'.repeat(32);

function record(count: number, n = 1, drawId = 'draw-1'): OfficeDrawRecord {
  const ids = Array.from({ length: count }, (_, i) => `user-${String(i).padStart(3, '0')}`);
  return {
    drawId,
    round: 1,
    mode: 'race',
    n,
    candidates: ids.map((id) => ({ id, name: id, avatar: defaultAvatar(id) })),
    commitment: commitment(SEED),
    startsAt: 10_000,
    revealAt: 10_000 + DRAW_BUILD_UP_MS,
    seed: SEED,
    winners: drawWinners(SEED, drawId, ids, n),
    revealedAt: 10_000 + DRAW_BUILD_UP_MS - 400,
  };
}

describe('draw timeline', () => {
  const r = record(5);
  const { seed: _seed, winners: _winners, revealedAt: _at, ...started } = r;

  it('countdown, build-up, landing, done', () => {
    expect(phaseAt(r, 9_000, true)).toEqual({ kind: 'countdown', msLeft: 1_000 });
    expect(phaseAt(r, 11_000, true)).toEqual({ kind: 'buildUp', t: 1_000 });
    expect(phaseAt(r, r.revealAt + 10, true)).toMatchObject({ kind: 'landing', t: 10 });
    expect(phaseAt(r, r.revealAt + DRAW_LANDING_MS, true)).toMatchObject({ kind: 'done' });
  });

  it('a late reveal keeps the build-up going; without animations the result just appears', () => {
    expect(phaseAt(started, r.revealAt + 500, true)).toEqual({ kind: 'buildUp', t: DRAW_BUILD_UP_MS + 500 });
    expect(phaseAt(r, r.revealAt - 1, false)).toMatchObject({ kind: 'countdown' });
    expect(phaseAt(r, r.revealAt, false)).toMatchObject({ kind: 'done' });
  });
});

describe('race', () => {
  it('ends exactly on the result: winners cross the line in order, the others stop short', () => {
    for (const [count, n] of [
      [2, 1],
      [12, 1],
      [12, 3],
      [200, 3],
    ] as const) {
      const r = record(count, n);
      const lanes = raceLanes(r, r);
      expect(lanes.length).toBe(Math.min(count, MAX_LANES));
      for (const w of r.winners) expect(lanes).toContain(w);
      const end = lanes.map((id, lane) => landingProgress(r, id, lane, DRAW_LANDING_MS));
      lanes.forEach((id, lane) => {
        if (r.winners.includes(id)) expect(end[lane]).toBeCloseTo(1, 5);
        else expect(end[lane]!).toBeLessThan(0.9);
      });
      // Winner k reaches the line before winner k + 1.
      const finish = (id: string) => {
        const lane = lanes.indexOf(id);
        for (let t = 0; t <= DRAW_LANDING_MS; t += 10) if (landingProgress(r, id, lane, t) > 0.999) return t;
        return Infinity;
      };
      for (let k = 1; k < r.winners.length; k++)
        expect(finish(r.winners[k - 1]!)).toBeLessThan(finish(r.winners[k]!));
    }
  });

  it('the landing starts where the build-up ended, and the build-up never gives the result away', () => {
    const r = record(8);
    raceLanes(r).forEach((id, lane) => {
      expect(landingProgress(r, id, lane, 0)).toBeCloseTo(
        buildUpProgress(r.drawId, lane, DRAW_BUILD_UP_MS),
        6,
      );
      for (let t = 0; t <= DRAW_BUILD_UP_MS + 2000; t += 250)
        expect(buildUpProgress(r.drawId, lane, t)).toBeLessThanOrEqual(0.6);
    });
  });
});

describe('wheel', () => {
  it('comes to rest with the pointer on the first winner, for any size', () => {
    for (const count of [2, 3, 7, 12, 60, 200]) {
      for (const drawId of ['a', 'b', 'c']) {
        const r = record(count, 1, drawId);
        const angle = landingAngle(r, count, DRAW_LANDING_MS);
        expect(r.candidates[segmentAt(angle, count)]!.id).toBe(r.winners[0]);
      }
    }
  });

  it('is continuous at the reveal and only slows down during the landing', () => {
    const r = record(9);
    expect(landingAngle(r, 9, 0)).toBeCloseTo(buildUpAngle(DRAW_BUILD_UP_MS), 6);
    let last = landingAngle(r, 9, 0);
    let lastStep = Infinity;
    for (let t = 100; t <= DRAW_LANDING_MS; t += 100) {
      const a = landingAngle(r, 9, t);
      expect(a).toBeGreaterThanOrEqual(last);
      expect(a - last).toBeLessThanOrEqual(lastStep + 1e-9);
      lastStep = a - last;
      last = a;
    }
  });
});
