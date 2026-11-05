'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useGameDisabled } from '@/features/admin/games-status';
import type { GameId } from '@/games/catalog';
import type { MatchSetup } from '@/game-runtime/match-setup';

function Loading() {
  const t = useTranslations('match');
  return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('loading')}</p>;
}

// Client only: the match uses a random seed, localStorage settings and a Web Worker.
const MatchScreen = dynamic(() => import('@/features/match/MatchScreen').then((m) => m.MatchScreen), {
  ssr: false,
  loading: Loading,
});

export function PlayClient({ gameId, setup }: { gameId: GameId; setup: MatchSetup }) {
  const t = useTranslations('catalog');
  // Turned off by an admin (FR-CAT-03). Unknown (offline) counts as on.
  if (useGameDisabled(gameId)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-lg" data-testid="game-paused">
          {t('pausedNote')}
        </p>
        <Link href="/board-games" className="btn mt-6">
          {t('backToGames')}
        </Link>
      </div>
    );
  }
  return <MatchScreen key={JSON.stringify(setup)} gameId={gameId} setup={setup} />;
}
