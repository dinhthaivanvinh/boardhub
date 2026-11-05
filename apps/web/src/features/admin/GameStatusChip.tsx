'use client';

import { useTranslations } from 'next-intl';
import { useGameDisabled } from './games-status';

/** "Paused" label on a game card when an admin has turned the game off. */
export function GameStatusChip({ gameId }: { gameId: string }) {
  const t = useTranslations('catalog');
  const disabled = useGameDisabled(gameId);
  if (!disabled) return null;
  return (
    <span className="chip game-card-paused" data-testid={`paused-${gameId}`}>
      {t('paused')}
    </span>
  );
}
