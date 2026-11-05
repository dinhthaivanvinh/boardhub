'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { useDrawClock } from '../draw-player/use-draw-clock';

/**
 * The phone during a draw: "look at the screen" while it runs, then the result — on the same clock as
 * the stage (always the animated timeline), so phones never spoil the ending.
 */
export function ParticipantDraw({
  draw,
  serverOffset,
  meId,
}: {
  draw: OfficeDrawStarted | OfficeDrawRecord;
  serverOffset: number;
  meId: string;
}) {
  const t = useTranslations('officeSession.draw');
  const phase = useDrawClock(draw, serverOffset, true);
  const record = phase.kind === 'done' ? phase.record : null;
  const won = record?.winners.includes(meId) ?? false;

  useEffect(() => {
    if (won) navigator.vibrate?.([200, 100, 200]);
  }, [won]);

  if (!record) {
    return (
      <p className="card draw-phone draw-phone-running w-full" role="status" data-testid="participant-draw">
        🎲 {t('drawingPhone')}
      </p>
    );
  }
  const names = record.winners.map((id) => record.candidates.find((c) => c.id === id)?.name ?? '?');
  return (
    <div
      className={won ? 'card draw-phone draw-phone-won w-full' : 'card draw-phone w-full'}
      role="status"
      aria-live="assertive"
      data-testid="participant-draw"
      data-won={won}
    >
      {won ? (
        <p className="text-2xl font-black">🎉 {t('youWon')}</p>
      ) : (
        <p>
          {t('picked', { n: names.length })}:{' '}
          <strong data-testid="participant-winner">{names.join(', ')}</strong>
        </p>
      )}
    </div>
  );
}
