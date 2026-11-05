import { createRng } from '@bg/engine';
import { DRAW_BUILD_UP_MS, DRAW_LANDING_MS } from '@bg/office-core';
import { easeInOut } from './timeline';

/**
 * Máy gắp thú (docs/office/07 §3): the claw slides left and right above the herd, faster and faster; at the
 * reveal it moves over the winner, drops, grabs and lifts them. Coordinates are fractions of the play area
 * (x: 0 = left, 1 = right; y: 0 = the rail at the top, 1 = the bottom).
 */
export interface Claw {
  x: number;
  y: number;
  /** True once the claw holds the winner (the winner moves with it). */
  holding: boolean;
}

/** Fractions of the landing: slide over the winner, drop, then lift. */
export const CLAW_SLIDE = 0.45;
export const CLAW_DROP = 0.72;

export function buildUpClaw(drawId: string, t: number): Claw {
  const s = t / 1000;
  const start = createRng(`${drawId}:claw`, 0).next() * Math.PI * 2;
  // Frequency goes from 0.35 Hz to ~1.2 Hz during the build-up, then stays there.
  const b = Math.min(s, DRAW_BUILD_UP_MS / 1000);
  const late = Math.max(0, s - DRAW_BUILD_UP_MS / 1000);
  const fEnd = 1.2;
  const fStart = 0.35;
  const k = (fEnd - fStart) / (DRAW_BUILD_UP_MS / 1000);
  const phase = 2 * Math.PI * (fStart * b + 0.5 * k * b * b + fEnd * late);
  return { x: 0.5 + 0.42 * Math.sin(start + phase), y: 0, holding: false };
}

/** `target` is where the winner's animal is on this screen (fractions of the play area). */
export function landingClaw(drawId: string, target: { x: number; y: number }, t: number): Claw {
  const from = buildUpClaw(drawId, DRAW_BUILD_UP_MS).x;
  const u = Math.min(1, Math.max(0, t / DRAW_LANDING_MS));
  if (u < CLAW_SLIDE)
    return { x: from + (target.x - from) * easeInOut(u / CLAW_SLIDE), y: 0, holding: false };
  if (u < CLAW_DROP) {
    return {
      x: target.x,
      y: target.y * easeInOut((u - CLAW_SLIDE) / (CLAW_DROP - CLAW_SLIDE)),
      holding: false,
    };
  }
  return { x: target.x, y: target.y * (1 - easeInOut((u - CLAW_DROP) / (1 - CLAW_DROP))), holding: true };
}
