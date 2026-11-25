'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { dailyPuzzle, PieceGlyph, STARS_PER_PUZZLE } from '@bg/game-chess';
import { Star } from './AdventureMap';
import { usePuzzleProgress, useToday } from './use-progress';

/** The pieces of a FEN placement as a list of 64 squares (null = empty), white at the bottom. */
function squares(fen: string): (string | null)[] {
  const out: (string | null)[] = [];
  for (const ch of fen.split(' ')[0]!) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null);
    else out.push(`${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toUpperCase()}`);
  }
  return out;
}

/** Today's puzzle with a small board, so a child sees what is waiting; the puzzle itself is on its own page. */
export function DailyChallenge() {
  const t = useTranslations('portal.daily');
  const tl = useTranslations('games.chess.learn.puzzles');
  const today = useToday();
  const puzzles = usePuzzleProgress();
  const puzzle = today ? dailyPuzzle(today) : null;
  const cells = puzzle ? squares(puzzle.fen) : [];
  const done = puzzles.daily.includes(today);

  return (
    <div className="adv-daily">
      <div className="adv-daily-board" data-game="chess" role="img" aria-label={t('boardLabel')}>
        {Array.from({ length: 64 }, (_, i) => {
          const piece = cells[i];
          return (
            <span key={i} className="adv-daily-cell" data-dark={(Math.floor(i / 8) + (i % 8)) % 2 === 1}>
              {piece && <PieceGlyph piece={piece as 'wK'} size={40} />}
            </span>
          );
        })}
      </div>
      <div className="adv-daily-body">
        <h2 id="home-daily" className="adv-daily-title">
          {t('title')}
        </h2>
        <p className="adv-daily-text">{t('text')}</p>
        <ul className="adv-daily-facts">
          {puzzle && (
            <li>
              <span>{t('level')}</span> <strong>{tl(`tier.${puzzle.tier}.name`)}</strong>
            </li>
          )}
          <li>
            <span>{t('reward')}</span>{' '}
            <strong className="adv-daily-stars">
              {Array.from({ length: STARS_PER_PUZZLE }, (_, i) => (
                <Star key={i} on size={22} />
              ))}
              {t('stars', { n: STARS_PER_PUZZLE })}
            </strong>
          </li>
        </ul>
        <Link
          href="/puzzles/daily"
          className={`adv-btn ${done ? 'adv-btn-light' : 'adv-btn-gold'}`}
          data-testid="daily-go"
        >
          {done ? t('again') : t('go')}
        </Link>
        {done && <p className="adv-daily-done">{t('done')}</p>}
      </div>
      <Image
        src="/scene/mascot-thumbs.webp"
        alt=""
        width={140}
        height={200}
        loading="lazy"
        className="adv-daily-mascot"
      />
    </div>
  );
}
