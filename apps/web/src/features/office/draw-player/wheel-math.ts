import { createRng } from '@bg/engine';
import { DRAW_BUILD_UP_MS, DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord } from '@bg/protocol';

/** Degrees per second at the start and at the end of the build-up. */
const SPIN_FROM = 90;
const SPIN_TO = 540;

/** Wheel angle (degrees, clockwise) during the build-up: it spins faster and faster. */
export function buildUpAngle(t: number): number {
  const s = Math.min(t, DRAW_BUILD_UP_MS) / 1000;
  const accel = (SPIN_TO - SPIN_FROM) / (DRAW_BUILD_UP_MS / 1000);
  const angle = SPIN_FROM * s + 0.5 * accel * s * s;
  // A late reveal: keep spinning at full speed.
  return angle + (Math.max(0, t - DRAW_BUILD_UP_MS) / 1000) * SPIN_TO;
}

/** A point inside slice `index` (of `count`), a little off-centre, as the wheel angle that puts it under the pointer. */
function restFor(index: number, count: number, salt: string): number {
  const seg = 360 / count;
  const offset = (createRng(salt, 0).next() - 0.5) * seg * 0.6;
  // Slice i spans [i·seg, (i+1)·seg) clockwise from the top; turning the wheel by R puts the
  // point at -R under the pointer.
  return -((index + 0.5) * seg + offset);
}

/** The angle at which the pointer (at the top) sits inside the first winner's slice. */
export function restingAngle(record: OfficeDrawRecord, count: number): number {
  const index = record.candidates.findIndex((c) => c.id === record.winners[0]);
  return restFor(index, count, `${record.seed}:wheel`);
}

/**
 * Eases out from `from` to rest on `rest` (mod 360) in `duration` ms. The number of extra turns is chosen
 * so the speed at the start roughly matches `speed` (degrees per second).
 */
function easeTo(from: number, rest: number, duration: number, speed: number, t: number): number {
  // easeOutCubic starts at 3× the average speed.
  const wanted = (speed * (duration / 1000)) / 3;
  let to = rest + 360 * Math.ceil((from - rest) / 360);
  while (to - from < wanted - 180) to += 360;
  const x = Math.min(1, Math.max(0, t / duration));
  return from + (to - from) * (1 - (1 - x) ** 3);
}

/** Landing: from the build-up angle, ease out to rest exactly on the first winner. */
export function landingAngle(record: OfficeDrawRecord, count: number, t: number): number {
  return easeTo(buildUpAngle(DRAW_BUILD_UP_MS), restingAngle(record, count), DRAW_LANDING_MS, SPIN_TO, t);
}

/** Above this many people the wheel spins groups of WHEEL_GROUP, then the winning group (docs/office/07 §3). */
export const WHEEL_MAX_SLICES = 60;
export const WHEEL_GROUP = 12;
/** Part of the landing spent on the group wheel; the rest spins the winning group. */
export const GROUP_PHASE = 0.5;

export const isGrouped = (count: number) => count > WHEEL_MAX_SLICES;
export const groupCount = (count: number) => Math.ceil(count / WHEEL_GROUP);
/** Candidate indices of group `g` (candidates are already sorted). */
export const groupRange = (g: number, count: number): [number, number] => [
  g * WHEEL_GROUP,
  Math.min(count, (g + 1) * WHEEL_GROUP),
];

export type GroupedFrame =
  { stage: 'groups'; angle: number } | { stage: 'members'; group: number; angle: number };

/** Landing with groups: the group wheel stops on the winner's group, then that group spins onto the winner. */
export function groupedLanding(record: OfficeDrawRecord, count: number, t: number): GroupedFrame {
  const winner = record.candidates.findIndex((c) => c.id === record.winners[0]);
  const group = Math.floor(winner / WHEEL_GROUP);
  const groups = groupCount(count);
  const first = DRAW_LANDING_MS * GROUP_PHASE;
  if (t < first) {
    const rest = restFor(group, groups, `${record.seed}:wheel-group`);
    return { stage: 'groups', angle: easeTo(buildUpAngle(DRAW_BUILD_UP_MS), rest, first, SPIN_TO, t) };
  }
  const [lo, hi] = groupRange(group, count);
  const rest = restFor(winner - lo, hi - lo, `${record.seed}:wheel-member`);
  return { stage: 'members', group, angle: easeTo(0, rest, DRAW_LANDING_MS - first, 900, t - first) };
}

/** Which candidate the pointer is on at a given wheel angle. */
export function segmentAt(angle: number, count: number): number {
  const seg = 360 / count;
  const pointer = (((-angle % 360) + 360) % 360) / seg;
  return Math.floor(pointer) % count;
}
