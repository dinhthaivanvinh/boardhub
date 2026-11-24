'use client';

import { useTranslations } from 'next-intl';
import { PieceGlyph, learnerRank, streak, totalStars } from '@bg/game-chess';
import { useDoneLessons, usePuzzleProgress, useToday } from './use-progress';

/** Everything a child has earned so far, worked out from what is stored on this device. */
export function useLearnStats() {
  const done = useDoneLessons();
  const puzzles = usePuzzleProgress();
  const today = useToday();
  const stars = totalStars(done, puzzles);
  return {
    done,
    puzzles,
    today,
    stars,
    rank: learnerRank(stars),
    streak: today ? streak(puzzles.days, today) : 0,
  };
}

/** The rank, the stars and the streak as three coloured chips. */
export function LearnStats({ className = '' }: { className?: string }) {
  const t = useTranslations('games.chess.learn');
  const { stars, rank, streak: days } = useLearnStats();
  return (
    <ul className={`learn-stats ${className}`} aria-label={t('journey.rank')}>
      <li className="learn-stat" data-i="0" data-testid="stat-rank">
        <span className="learn-stat-icon" aria-hidden="true">
          {rank.rank.id === 'chick' ? '🐣' : <PieceGlyph piece={`w${rank.rank.piece}`} size={24} />}
        </span>
        {t(`journey.ranks.${rank.rank.id}`)}
      </li>
      <li className="learn-stat" data-i="1" data-testid="stat-stars">
        {t('journey.starsTotal', { n: stars })}
      </li>
      <li className="learn-stat" data-i="2" data-testid="stat-streak">
        <span aria-hidden="true">🔥</span>{' '}
        {days > 0 ? t('journey.streak', { n: days }) : t('puzzles.noStreak')}
      </li>
    </ul>
  );
}
