import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { isRevealed, phaseAt, type DrawPhase } from '@/features/office/draw-player/timeline';

/**
 * One turn of Lì xì on server time (docs/office/activities/li-xi.md §7). The usual draw (countdown, the
 * spotlight building up and landing) is followed by the person walking up and their envelope opening.
 * A pure function of time, like the office draws: every screen shows the same moment.
 *
 * With only one person left there is nothing to guess: no spotlight, they walk up as soon as the turn
 * starts. Which envelope they get is still secret until the reveal, so the envelope shakes until then
 * (the note is hidden inside, so nothing shows before it is known).
 */
export const LI_XI_STEPS = [
  ['walk', 1400],
  ['envelope', 800],
  ['shake', 1000],
  ['open', 600],
  /** The note comes up out of the envelope, still upright. */
  ['pull', 700],
  /** It grows, turns flat and shakes about: the amount is shown. */
  ['note', 1300],
] as const;

export type LiXiStep = (typeof LI_XI_STEPS)[number][0] | 'shown';

export type LiXiPhase =
  | Exclude<DrawPhase, { kind: 'done' }>
  /** After the spotlight: `t` is the time since this step began. */
  | {
      kind: 'gift';
      step: LiXiStep;
      t: number;
      /** Not yet revealed only for the last person, before the envelope opens. */
      record: OfficeDrawStarted | OfficeDrawRecord;
    };

/** How long the whole turn lasts after the spotlight stops. */
export const LI_XI_GIFT_MS = LI_XI_STEPS.reduce((s, [, ms]) => s + ms, 0);

/** From the walk to the end of the shake: what the last person can do before the reveal. */
const BEFORE_OPEN_MS = LI_XI_STEPS.slice(0, 3).reduce((s, [, ms]) => s + ms, 0);

/** Only one person left to call: who it is is no surprise. */
export const lastOne = (draw: OfficeDrawStarted | OfficeDrawRecord) => draw.candidates.length === 1;

/** Who is called: known from the start for the last person, otherwise at the reveal. */
export const calledId = (draw: OfficeDrawStarted | OfficeDrawRecord): string | null =>
  lastOne(draw) ? (draw.candidates[0]?.id ?? null) : isRevealed(draw) ? (draw.winners[0] ?? null) : null;

/** When the envelope starts opening (server time), or null while that is not known yet. */
function openAt(draw: OfficeDrawStarted | OfficeDrawRecord): number | null {
  if (!isRevealed(draw)) return null;
  return lastOne(draw)
    ? Math.max(draw.startsAt + BEFORE_OPEN_MS, draw.revealedAt ?? draw.revealAt)
    : draw.revealAt + DRAW_LANDING_MS + BEFORE_OPEN_MS;
}

/** When the turn has finished on every screen (server time), or null while that is not known yet. */
export function turnEndsAt(draw: OfficeDrawStarted | OfficeDrawRecord): number | null {
  const at = openAt(draw);
  return at === null ? null : at + LI_XI_GIFT_MS - BEFORE_OPEN_MS;
}

function stepAt(t: number, from: number, record: OfficeDrawStarted | OfficeDrawRecord): LiXiPhase {
  for (const [step, ms] of LI_XI_STEPS.slice(from)) {
    if (t < ms) return { kind: 'gift', step, t, record };
    t -= ms;
  }
  return { kind: 'gift', step: 'shown', t, record };
}

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
  if (lastOne(draw)) {
    if (now < draw.startsAt) return { kind: 'countdown', msLeft: draw.startsAt - now };
    const open = openAt(draw);
    if (open === null || now < open) {
      const t = now - draw.startsAt;
      // Waiting for the reveal: the envelope keeps shaking.
      return t < BEFORE_OPEN_MS ? stepAt(t, 0, draw) : { kind: 'gift', step: 'shake', t: 0, record: draw };
    }
    return stepAt(now - open, 3, draw);
  }
  const base = phaseAt(draw, now, true);
  if (base.kind !== 'done') return base;
  return stepAt(now - draw.revealAt - DRAW_LANDING_MS, 0, base.record);
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
