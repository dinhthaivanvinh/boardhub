'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { COORDINATES_LESSON_ID, OPENING_LESSONS, PIECE_LESSONS, SPECIAL_LESSONS } from '@bg/game-chess';
import { useDoneLessons } from './use-progress';

export function LearnHome() {
  const t = useTranslations();
  const done = useDoneLessons();
  const item = (id: string, title: string, intro: string) => (
    <li key={id}>
      <Link href={`/learn/chess/${id}`} className="card flex items-center justify-between gap-3 p-4">
        <span>
          <strong className="block">{title}</strong>
          <span className="text-sm text-[var(--muted)]">{intro}</span>
        </span>
        <span className="shrink-0 text-sm">
          {done.has(id) ? `✓ ${t('games.chess.learn.completed')}` : t('games.chess.learn.start')}
        </span>
      </Link>
    </li>
  );
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('games.chess.learn.title')}</h1>
        <p className="mt-2 text-[var(--muted)]">{t('games.chess.learn.subtitle')}</p>
      </header>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('games.chess.learn.coordinatesHeading')}</h2>
        <ul className="grid gap-3">
          {item(
            COORDINATES_LESSON_ID,
            t('games.chess.learn.coordinates.name'),
            t('games.chess.learn.coordinates.intro.rank'),
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('games.chess.learn.piecesHeading')}</h2>
        <ul className="grid gap-3">
          {PIECE_LESSONS.map((l) =>
            item(l.id, t(`games.chess.pieceNames.${l.piece}`), t(`games.chess.learn.pieces.${l.id}.meet`)),
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('games.chess.learn.openingsHeading')}</h2>
        <ul className="grid gap-3">
          {OPENING_LESSONS.map((l) =>
            item(
              l.id,
              t(`games.chess.learn.openings.${l.id}.name`),
              t(`games.chess.learn.openings.${l.id}.intro`),
            ),
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('games.chess.learn.specialsHeading')}</h2>
        <ul className="grid gap-3">
          {SPECIAL_LESSONS.map((l) =>
            item(
              l.id,
              t(`games.chess.learn.specials.${l.id}.name`),
              t(`games.chess.learn.specials.${l.id}.meet`),
            ),
          )}
        </ul>
      </section>
      <Link href="/games/chess" className="btn w-fit">
        {t('games.chess.learn.playChess')}
      </Link>
    </div>
  );
}
