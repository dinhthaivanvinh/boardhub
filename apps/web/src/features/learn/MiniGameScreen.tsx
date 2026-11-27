'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MiniGame, MINI_LEVELS, miniKey, type MiniGameId } from '@bg/game-chess';
import { BoardStage } from '@/components/BoardStage';
import { useMiniProgress, useSaveMiniStars } from './use-mini-progress';
import { useReducedMotion } from './use-reduced-motion';

/** One of the little games: its levels along the top, the board below. */
export function MiniGameScreen({ game }: { game: MiniGameId }) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const progress = useMiniProgress();
  const save = useSaveMiniStars();
  const [level, setLevel] = useState(1);
  const levels = Array.from({ length: MINI_LEVELS[game] }, (_, i) => i + 1);
  const L = 'games.chess.learn.mini';
  const levelName = (n: number) => (game === 'pawn-race' ? t(`${L}.pawnLevel.${n}`) : t(`${L}.level`, { n }));

  return (
    <div
      className="stage-screen lesson-scene mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
    >
      <BoardStage />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="stage-aside min-w-0">
          <header className="ch-learn-header">
            <h1 className="ch-learn-title">{t(`${L}.${game}.name`)}</h1>
            <Link href="/mini-games" className="btn ch-back">
              <span aria-hidden="true">←</span> {t(`${L}.back`)}
            </Link>
            <div className="mini-levels" role="group" aria-label={t(`${L}.choose`)}>
              {levels.map((n) => {
                const stars = progress[miniKey(game, n)] ?? 0;
                return (
                  <button
                    key={n}
                    type="button"
                    className="mini-level"
                    aria-pressed={n === level}
                    onClick={() => setLevel(n)}
                    data-testid={`mini-level-${n}`}
                  >
                    <span>{levelName(n)}</span>
                    <span className="mini-level-stars">
                      <span aria-hidden="true">{stars > 0 ? '⭐'.repeat(stars) : '☆'}</span>
                      <span className="sr-only">{t(`${L}.starsEarned`, { count: stars })}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </header>
          <MiniGame
            key={`${game}:${level}`}
            game={game}
            level={level}
            t={t}
            lang={locale}
            animate={!reduced}
            onWon={(stars) => save(game, level, stars)}
            footer={
              level < MINI_LEVELS[game] ? (
                <button type="button" className="btn btn-primary ch-next" onClick={() => setLevel(level + 1)}>
                  {t(`${L}.next`)}
                </button>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
