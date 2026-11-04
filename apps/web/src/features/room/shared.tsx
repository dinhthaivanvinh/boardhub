'use client';

import { useEffect, useState } from 'react';
import type { ClockView, SeatOccupant, TimeControl } from '@bg/protocol';

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

export function seatName(t: T, occ: SeatOccupant | null, myUserId: string | null): string {
  if (!occ) return t('room.empty');
  if (occ.kind === 'bot') return t('room.bot', { level: t(`bot.level.${occ.level}`) });
  return occ.userId === myUserId ? `${occ.name} (${t('room.you')})` : occ.name;
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
