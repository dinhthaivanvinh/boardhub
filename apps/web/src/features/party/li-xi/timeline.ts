import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { isRevealed, phaseAt, type DrawPhase } from '@/features/office/draw-player/timeline';

/**
 * One turn of Lì xì on server time (docs/office/activities/li-xi.md §7). The usual draw (countdown, the
 * spotlight building up and landing) is followed by the person walking up and their envelope opening.
 * A pure function of time, like the office draws: every screen shows the same moment.
 */
export const LI_XI_STEPS = [
  ['walk', 1400],
  ['envelope', 800],
  ['shake', 1000],
  ['open', 600],
  ['note', 1000],
] as const;

export type LiXiStep = (typeof LI_XI_STEPS)[number][0] | 'shown';

export type LiXiPhase =
  | Exclude<DrawPhase, { kind: 'done' }>
  /** After the spotlight: `t` is the time since this step began. */
  | { kind: 'gift'; step: LiXiStep; t: number; record: OfficeDrawRecord };

/** How long the whole turn lasts after the spotlight stops. */
export const LI_XI_GIFT_MS = LI_XI_STEPS.reduce((s, [, ms]) => s + ms, 0);

export function liXiPhaseAt(
  draw: OfficeDrawStarted | OfficeDrawRecord,
  now: number,
  animate: boolean,
): LiXiPhase {
  if (!animate) {
    return isRevealed(draw) && now >= draw.revealAt
      ? { kind: 'gift', step: 'shown', t: 0, record: draw }
      : { kind: 'countdown', msLeft: Math.max(0, draw.revealAt - now) };
  }
  const base = phaseAt(draw, now, true);
  if (base.kind !== 'done') return base;
  let t = now - draw.revealAt - DRAW_LANDING_MS;
  for (const [step, ms] of LI_XI_STEPS) {
    if (t < ms) return { kind: 'gift', step, t, record: base.record };
    t -= ms;
  }
  return { kind: 'gift', step: 'shown', t, record: base.record };
}

/** Whether `step` has been reached (the envelope is visible from "envelope" on, and so on). */
export function reached(phase: LiXiPhase, step: LiXiStep): boolean {
  if (phase.kind !== 'gift') return false;
  const order: LiXiStep[] = [...LI_XI_STEPS.map(([s]) => s), 'shown'];
  return order.indexOf(phase.step) >= order.indexOf(step);
}

/** Changes only when React has something new to draw (the step, or the countdown second). */
export const liXiPhaseKey = (p: LiXiPhase) =>
  p.kind === 'countdown' ? `c${Math.ceil(p.msLeft / 1000)}` : p.kind === 'gift' ? p.step : p.kind;
