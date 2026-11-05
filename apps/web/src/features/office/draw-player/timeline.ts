import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';

export type DrawPhase =
  | { kind: 'countdown'; msLeft: number }
  /** Nobody knows the result yet. `t` keeps growing if the reveal is late. */
  | { kind: 'buildUp'; t: number }
  | { kind: 'landing'; t: number; record: OfficeDrawRecord }
  | { kind: 'done'; record: OfficeDrawRecord };

export const isRevealed = (d: OfficeDrawStarted | OfficeDrawRecord): d is OfficeDrawRecord => 'seed' in d;

/**
 * Where a draw is at server time `now` (docs/office/07 §5): a pure function of time, so every screen —
 * and a tab that was hidden, or someone who joins mid-draw — shows the same frame.
 * Without animations, the result simply appears at the reveal.
 */
export function phaseAt(
  draw: OfficeDrawStarted | OfficeDrawRecord,
  now: number,
  animate: boolean,
): DrawPhase {
  if (!animate) {
    return isRevealed(draw) && now >= draw.revealAt
      ? { kind: 'done', record: draw }
      : { kind: 'countdown', msLeft: Math.max(0, draw.revealAt - now) };
  }
  if (now < draw.startsAt) return { kind: 'countdown', msLeft: draw.startsAt - now };
  if (!isRevealed(draw) || now < draw.revealAt) return { kind: 'buildUp', t: now - draw.startsAt };
  const t = now - draw.revealAt;
  return t < DRAW_LANDING_MS ? { kind: 'landing', t, record: draw } : { kind: 'done', record: draw };
}

/** Slows down towards the end, like a wheel or a runner easing off. */
export const easeOutCubic = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** Slow start, fast middle, slow end: one hop of a light or a claw. */
export const easeInOut = (x: number) => {
  const v = Math.min(1, Math.max(0, x));
  return v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2;
};
