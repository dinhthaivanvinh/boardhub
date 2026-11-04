'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
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
  return <MatchScreen key={JSON.stringify(setup)} gameId={gameId} setup={setup} />;
}
