'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BADGES, earnedBadges, JOURNEY_LESSONS, PieceGlyph } from '@bg/game-chess';
import { Star } from './AdventureMap';
import { useLearnStats } from './LearnStats';

/** What the child has earned, all worked out from the progress stored on this device (no made-up numbers). */
export function Achievements() {
  const t = useTranslations('portal.achievements');
  const tj = useTranslations('games.chess.learn.journey');
  const { done, puzzles, today, stars, rank, streak } = useLearnStats();
  const earned = new Set(earnedBadges(done, puzzles, today || '1970-01-01'));
  const lessons = JOURNEY_LESSONS.filter((id) => done.has(id)).length;

  return (
    <div>
      <h2 id="home-achievements" className="adv-section-title">
        {t('title')}
      </h2>
      <ul className="adv-stats">
        <li className="adv-stat" data-k="stars" data-testid="ach-stars">
          <Star on size={36} />
          <strong>{stars}</strong>
          <span>{t('stars')}</span>
        </li>
        <li className="adv-stat" data-k="level" data-testid="ach-level">
          <span className="adv-stat-art" data-game="chess" aria-hidden="true">
            {rank.rank.id === 'chick' ? '🐣' : <PieceGlyph piece={`w${rank.rank.piece}`} size={36} />}
          </span>
          <strong>{tj(`ranks.${rank.rank.id}`)}</strong>
          <span>{t('level')}</span>
        </li>
        <li className="adv-stat" data-k="lessons" data-testid="ach-lessons">
          <span className="adv-stat-art" aria-hidden="true">
            ✓
          </span>
          <strong>
            {lessons}/{JOURNEY_LESSONS.length}
          </strong>
          <span>{t('lessons')}</span>
        </li>
        <li className="adv-stat" data-k="streak" data-testid="ach-streak">
          <span className="adv-stat-art" aria-hidden="true">
            🔥
          </span>
          <strong>{streak}</strong>
          <span>{t('streak')}</span>
        </li>
      </ul>

      <h3 className="adv-badges-title">{t('badges', { n: earned.size, total: BADGES.length })}</h3>
      <ul className="adv-badges">
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          return (
            <li key={b.id} className="adv-badge" data-earned={got}>
              <span className="adv-badge-icon" aria-hidden="true">
                {got ? b.icon : '🔒'}
              </span>
              <span className="adv-badge-name">{tj(`badge.${b.id}.name`)}</span>
              {!got && <span className="sr-only">{tj('locked')}</span>}
            </li>
          );
        })}
      </ul>
      <p className="adv-badges-more">
        <Link href="/journey" className="adv-btn adv-btn-light">
          {t('all')}
        </Link>
      </p>
    </div>
  );
}
