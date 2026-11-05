import { createRng } from '@bg/engine';
import { DRAW_BUILD_UP_MS, DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { easeOutCubic } from './timeline';

/** At most this many runners on the track; the rest of the pool still counts (docs/office/07 §3). */
export const MAX_LANES = 12;

/** The animals on the track. With many people, a random dozen runs the build-up; winners always run the landing. */
export function raceLanes(draw: OfficeDrawStarted | OfficeDrawRecord, revealed?: OfficeDrawRecord): string[] {
  const ids = draw.candidates.map((c) => c.id);
  if (ids.length <= MAX_LANES) return ids;
  const lanes = createRng(draw.drawId, 1).shuffle(ids).slice(0, MAX_LANES);
  if (!revealed) return lanes;
  // Winners who were not on the track take the places of the last runners.
  const missing = revealed.winners.filter((w) => !lanes.includes(w));
  let slot = MAX_LANES - 1;
  for (const w of missing) {
    while (revealed.winners.includes(lanes[slot]!)) slot--;
    lanes[slot] = w;
    slot--;
  }
  return lanes;
}

/** Build-up: everyone runs, leaders change, nobody gets past 60% of the track. */
export function buildUpProgress(drawId: string, lane: number, t: number): number {
  const rng = createRng(`${drawId}:lane:${lane}`, 0);
  const speed = 0.8 + rng.next() * 0.4;
  const wobble = 1.5 + rng.next() * 2;
  const phase = rng.next() * Math.PI * 2;
  const x = Math.min(t, DRAW_BUILD_UP_MS) / DRAW_BUILD_UP_MS;
  // After the build-up (a late reveal), they keep jogging on the spot.
  const late = Math.max(0, t - DRAW_BUILD_UP_MS) / 1000;
  return Math.min(
    0.6,
    0.02 + 0.5 * x * speed + 0.035 * Math.sin(x * wobble * Math.PI * 2 + phase + late * 4),
  );
}

/**
 * Landing: winner k (0-based) crosses the line first, in order; the others stop short. Starts exactly where
 * the build-up ended (continuous), ends exactly on the result.
 */
export function landingProgress(record: OfficeDrawRecord, id: string, lane: number, t: number): number {
  const from = buildUpProgress(record.drawId, lane, DRAW_BUILD_UP_MS);
  const rank = record.winners.indexOf(id);
  if (rank >= 0) {
    const finishAt = DRAW_LANDING_MS * (0.7 + 0.08 * rank);
    return from + (1 - from) * easeOutCubic(t / finishAt);
  }
  const target = 0.62 + createRng(`${record.seed}:stop:${id}`, 0).next() * 0.26;
  return from + (target - from) * easeOutCubic(t / (DRAW_LANDING_MS * 0.9));
}
