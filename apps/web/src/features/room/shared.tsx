'use client';

import { useEffect, useState } from 'react';
import type { ClockView, SeatOccupant, TimeControl } from '@bg/protocol';
import { playSound } from '@/sound/play';

export type T = (key: string, values?: Record<string, string | number>) => string;

/** Re-renders every `ms` while `active`. */
export function useNow(ms = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

export function seatName(
  t: T,
  occ: SeatOccupant | null,
  myUserId: string | null,
  labels?: Map<string, string>,
): string {
  if (!occ) return t('room.empty');
  if (occ.kind === 'bot') return t('room.bot', { level: t(`bot.level.${occ.level}`) });
  const name = labels?.get(occ.userId) ?? occ.name;
  return occ.userId === myUserId ? `${name} (${t('room.you')})` : name;
}

export function timeControlLabel(t: T, tc: TimeControl): string {
  if (tc.type === 'none') return t('setup.timeControls.none');
  if (tc.type === 'per-move') return t('setup.timeControls.perMove', { s: Math.round(tc.moveMs / 1000) });
  return t('setup.timeControls.fischer', {
    m: Math.round(tc.baseMs / 60_000),
    s: Math.round(tc.incrementMs / 1000),
  });
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** One tick a second during the last ten seconds of a running clock. */
export function useClockTicks(clock: ClockView | undefined, receivedAt: number) {
  const running = clock?.running === true;
  const remainingMs = clock?.remainingMs ?? 0;
  useEffect(() => {
    if (!running) return;
    let last = Number.POSITIVE_INFINITY;
    const id = window.setInterval(() => {
      const left = Math.ceil((remainingMs - (Date.now() - receivedAt)) / 1000);
      if (left > 0 && left <= 10 && left < last) playSound('clock');
      last = left;
    }, 200);
    return () => window.clearInterval(id);
  }, [running, remainingMs, receivedAt]);
}

/** Counts down locally from the last server snapshot. */
export function Clock({ clock, receivedAt }: { clock: ClockView; receivedAt: number }) {
  const now = useNow(200, clock.running);
  const remaining = clock.running ? clock.remainingMs - (now - receivedAt) : clock.remainingMs;
  const low = remaining < 10_000;
  return (
    <span
      className={`rounded-md px-2 py-0.5 font-mono text-sm tabular-nums ${
        clock.running ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'bg-[var(--bg)]'
      } ${low && clock.running ? 'animate-pulse' : ''}`}
      data-testid={`clock-${clock.seat}`}
    >
      {formatClock(remaining)}
    </span>
  );
}

/** "Mất kết nối (42s)" for a player in their grace period. */
export function Presence({ occ, serverOffset, t }: { occ: SeatOccupant | null; serverOffset: number; t: T }) {
  const offline = occ?.kind === 'user' && !occ.connected;
  const now = useNow(1000, offline);
  if (!offline || occ?.kind !== 'user') return null;
  const left = occ.graceUntil ? Math.max(0, Math.ceil((occ.graceUntil - (now + serverOffset)) / 1000)) : 0;
  return <span className="text-xs text-[var(--danger)]">{t('room.offline', { s: left })}</span>;
}
