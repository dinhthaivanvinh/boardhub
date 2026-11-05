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

/** The angle at which the pointer (at the top) sits inside segment `index`, a little off-centre. */
export function restingAngle(record: OfficeDrawRecord, count: number): number {
  const seg = 360 / count;
  const index = record.candidates.findIndex((c) => c.id === record.winners[0]);
  const offset = (createRng(`${record.seed}:wheel`, 0).next() - 0.5) * seg * 0.6;
  // Segment i spans [i·seg, (i+1)·seg) clockwise from the top; turning the wheel by R puts the
  // point at -R under the pointer.
  return -((index + 0.5) * seg + offset);
}

/**
 * Landing: from the build-up angle, ease out to rest exactly on the first winner. The number of extra
 * turns is chosen so the speed at the start of the landing roughly matches the build-up's last speed.
 */
export function landingAngle(record: OfficeDrawRecord, count: number, t: number): number {
  const from = buildUpAngle(DRAW_BUILD_UP_MS);
  const rest = restingAngle(record, count);
  // easeOutCubic starts at 3× the average speed: aim for the distance that gives SPIN_TO there.
  const wanted = (SPIN_TO * (DRAW_LANDING_MS / 1000)) / 3;
  let to = rest + 360 * Math.ceil((from - rest) / 360);
  while (to - from < wanted - 180) to += 360;
  const x = Math.min(1, t / DRAW_LANDING_MS);
  return from + (to - from) * (1 - (1 - x) ** 3);
}

/** Which candidate the pointer is on at a given wheel angle. */
export function segmentAt(angle: number, count: number): number {
  const seg = 360 / count;
  const pointer = (((-angle % 360) + 360) % 360) / seg;
  return Math.floor(pointer) % count;
}
