import { describe, expect, it } from 'vitest';
import { defaultAvatar } from '@bg/avatars';
import { commitment, DRAW_BUILD_UP_MS, DRAW_LANDING_MS, drawWinners } from '@bg/office-core';
import type { OfficeDrawRecord } from '@bg/protocol';
import {
  buildUpProgress,
  landingProgress,
  MAX_LANES,
  raceLanes,
} from '../src/features/office/draw-player/race-math';
import { phaseAt } from '../src/features/office/draw-player/timeline';
import { buildUpClaw, CLAW_DROP, landingClaw } from '../src/features/office/draw-player/claw-math';
import { buildUpSpot, landingSpot } from '../src/features/office/draw-player/spotlight-math';
import {
  buildUpAngle,
  GROUP_PHASE,
  groupCount,
  groupedLanding,
  groupRange,
  isGrouped,
  landingAngle,
  segmentAt,
  WHEEL_GROUP,
} from '../src/features/office/draw-player/wheel-math';

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

describe('wheel with many people', () => {
  it('spins groups of 12, stops on the winner group, then on the winner, for any size', () => {
    for (const count of [61, 120, 200]) {
      for (const drawId of ['a', 'b', 'c', 'd']) {
        const r = record(count, 1, drawId);
        const winner = r.candidates.findIndex((c) => c.id === r.winners[0]);
        const half = groupedLanding(r, count, DRAW_LANDING_MS * GROUP_PHASE - 1);
        expect(half.stage).toBe('groups');
        expect(segmentAt(half.angle, groupCount(count))).toBe(Math.floor(winner / WHEEL_GROUP));
        const end = groupedLanding(r, count, DRAW_LANDING_MS);
        if (end.stage !== 'members') throw new Error('expected the member wheel');
        const [lo, hi] = groupRange(end.group, count);
        expect(lo + segmentAt(end.angle, hi - lo)).toBe(winner);
      }
    }
  });

  it('only above 60 people', () => {
    expect(isGrouped(60)).toBe(false);
    expect(isGrouped(61)).toBe(true);
    expect(groupedLanding(record(61), 61, 0).angle).toBeCloseTo(buildUpAngle(DRAW_BUILD_UP_MS), 6);
  });
});

describe('spotlight', () => {
  const at = (s: { a: number; b: number; f: number }) => (s.f >= 1 ? s.b : s.f <= 0 ? s.a : null);

  it('stops exactly on the first winner, for any size', () => {
    for (const count of [1, 2, 7, 12, 200]) {
      for (const drawId of ['a', 'b', 'c']) {
        const r = record(count, 1, drawId);
        const spot = landingSpot(r, count, DRAW_LANDING_MS);
        expect(r.candidates[at(spot)!]!.id).toBe(r.winners[0]);
      }
    }
  });

  it('the landing continues the hop in progress at the reveal; cells stay in range', () => {
    const r = record(9);
    const end = buildUpSpot(r.drawId, 9, DRAW_BUILD_UP_MS);
    const start = landingSpot(r, 9, 0);
    expect([start.a, start.b]).toEqual([end.a, end.b]);
    expect(start.f).toBeCloseTo(end.f, 6);
    for (let t = 0; t < DRAW_BUILD_UP_MS + 2000; t += 37) {
      const s = buildUpSpot(r.drawId, 9, t);
      for (const c of [s.a, s.b]) expect(c >= 0 && c < 9).toBe(true);
    }
  });
});

describe('claw', () => {
  it('slides over the winner, drops onto it, then lifts it from where the build-up left off', () => {
    const target = { x: 0.8, y: 0.6 };
    const end = buildUpClaw('d', DRAW_BUILD_UP_MS);
    expect(landingClaw('d', target, 0).x).toBeCloseTo(end.x, 6);
    expect(landingClaw('d', target, DRAW_LANDING_MS * CLAW_DROP - 1)).toMatchObject({
      x: 0.8,
      holding: false,
    });
    expect(landingClaw('d', target, DRAW_LANDING_MS * CLAW_DROP - 1).y).toBeCloseTo(0.6, 2);
    expect(landingClaw('d', target, DRAW_LANDING_MS)).toEqual({ x: 0.8, y: 0, holding: true });
    for (let t = 0; t < DRAW_BUILD_UP_MS + 2000; t += 50) {
      const c = buildUpClaw('d', t);
      expect(c.x).toBeGreaterThanOrEqual(0.08 - 1e-9);
      expect(c.x).toBeLessThanOrEqual(0.92 + 1e-9);
    }
  });
});
