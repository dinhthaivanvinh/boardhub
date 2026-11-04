import type { ClockView, TimeControl } from '@bg/protocol';
import type { Clocks } from './types';

export function initClocks(
  tc: TimeControl,
  players: number,
  firstSeat: number | null,
  now: number,
): Clocks | null {
  if (tc.type === 'none') return null;
  const start = tc.type === 'fischer' ? tc.baseMs : tc.moveMs;
  return {
    remainingMs: Array.from({ length: players }, () => start),
    runningSeat: firstSeat,
    turnStartedAt: now,
  };
}

/** Charges the mover for the time used, adds the increment and starts the next seat's clock. */
export function clocksAfterMove(
  tc: TimeControl,
  clocks: Clocks,
  mover: number,
  nextSeat: number | null,
  now: number,
): Clocks {
  const remainingMs = clocks.remainingMs.slice();
  const used = now - clocks.turnStartedAt;
  if (tc.type === 'fischer')
    remainingMs[mover] = Math.max(0, (remainingMs[mover] ?? 0) - used) + tc.incrementMs;
  if (tc.type === 'per-move') remainingMs[mover] = tc.moveMs;
  return { remainingMs, runningSeat: nextSeat, turnStartedAt: now };
}

export function stopClocks(clocks: Clocks, now: number): Clocks {
  if (clocks.runningSeat === null) return clocks;
  const remainingMs = clocks.remainingMs.slice();
  const seat = clocks.runningSeat;
  remainingMs[seat] = Math.max(0, (remainingMs[seat] ?? 0) - (now - clocks.turnStartedAt));
  return { remainingMs, runningSeat: null, turnStartedAt: now };
}

/** Time at which the running seat runs out, or null if no clock is running. */
export function clockDeadline(clocks: Clocks | null): number | null {
  if (!clocks || clocks.runningSeat === null) return null;
  return clocks.turnStartedAt + (clocks.remainingMs[clocks.runningSeat] ?? 0);
}

export function clockViews(clocks: Clocks | null, now: number): ClockView[] | null {
  if (!clocks) return null;
  return clocks.remainingMs.map((ms, seat) => {
    const running = seat === clocks.runningSeat;
    return { seat, running, remainingMs: running ? Math.max(0, ms - (now - clocks.turnStartedAt)) : ms };
  });
}
