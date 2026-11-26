'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MINI_GAME_IDS, MINI_LEVELS, miniKey, type MiniGameId, type MiniProgress } from '@bg/game-chess';
import { PageBanner } from '@/features/home/PageBanner';
import { useMiniProgress } from './use-mini-progress';

export const MINI_ICON: Record<MiniGameId, string> = {
  'knight-stars': '🐴',
  'rook-wall': '🏰',
  'pawn-race': '🏁',
};

/** Stars earned in a game, out of three for every level. */
export const miniStars = (game: MiniGameId, progress: MiniProgress): { n: number; total: number } => ({
  n: Array.from({ length: MINI_LEVELS[game] }, (_, i) => progress[miniKey(game, i + 1)] ?? 0).reduce(
    (a, b) => a + b,
    0,
  ),
  total: MINI_LEVELS[game] * 3,
});

/** The three little games. */
export function MiniGamesScreen() {
  const t = useTranslations('games.chess.learn.mini');
  const progress = useMiniProgress();
  return (
    <div className="adv-page mx-auto grid max-w-5xl gap-6 px-4 py-6">
      <PageBanner title={t('title')} subtitle={t('subtitle')} mascot="mascot-pointing.webp" />
      <ul className="grid gap-3 md:grid-cols-3">
        {MINI_GAME_IDS.map((game, i) => (
          <li key={game} className="card puzzle-tier" data-i={i % 3}>
            <h2 className="puzzle-tier-name">
              <span aria-hidden="true">{MINI_ICON[game]}</span> {t(`${game}.name`)}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t(`${game}.text`)}</p>
            <p className="text-sm font-semibold" data-testid={`mini-stars-${game}`}>
              {t('stars', miniStars(game, progress))}
            </p>
            <Link
              href={`/mini-games/${game}`}
              className="btn btn-primary mt-auto"
              data-testid={`mini-${game}`}
            >
              {t('choose')}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
