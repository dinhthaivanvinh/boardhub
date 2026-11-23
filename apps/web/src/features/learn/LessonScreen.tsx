'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  OPENING_LESSONS,
  OpeningLesson,
  openingLesson,
  PIECE_LESSONS,
  PieceLesson,
  pieceLesson,
} from '@bg/game-chess';
import { useDoneLessons, useMarkDone } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

type NavItem = { id: string; label: string };

/** The other lessons of the same kind, to jump between them without going back to the list. */
function LessonNav({ heading, items, currentId }: { heading: string; items: NavItem[]; currentId: string }) {
  const t = useTranslations();
  const done = useDoneLessons();
  return (
    <nav aria-label={heading} className="md:sticky md:top-20 md:self-start">
      <h2 className="mb-2 hidden text-sm font-semibold text-[var(--muted)] md:block">{heading}</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
        {items.map((item) => {
          const current = item.id === currentId;
          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={`/learn/chess/${item.id}`}
                aria-current={current ? 'page' : undefined}
                className={`card flex items-center justify-between gap-2 px-3 py-2 text-sm whitespace-nowrap md:whitespace-normal ${
                  current ? 'font-bold ring-2 ring-sky-500' : ''
                }`}
              >
                <span>{item.label}</span>
                {done.has(item.id) && <span aria-label={t('games.chess.learn.completed')}>✓</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const markDone = useMarkDone();
  const piece = pieceLesson(lessonId);
  const opening = openingLesson(lessonId);
  return (
    <div
      className="mx-auto grid max-w-6xl gap-3 px-4 py-4"
      data-game="chess"
      style={piece || opening ? ({ '--ch-nav': '15rem' } as React.CSSProperties) : undefined}
    >
      <Link href="/learn/chess" className="text-sm underline-offset-4 hover:underline">
        ← {t('games.chess.learn.backToList')}
      </Link>
      {piece && (
        <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <LessonNav
            heading={t('games.chess.learn.piecesHeading')}
            items={PIECE_LESSONS.map((l) => ({ id: l.id, label: t(`games.chess.pieceNames.${l.piece}`) }))}
            currentId={piece.id}
          />
          <PieceLesson
            key={piece.id}
            lesson={piece}
            t={t}
            animate={!reduced}
            onComplete={markDone}
            lang={locale}
          />
        </div>
      )}
      {opening && (
        <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <LessonNav
            heading={t('games.chess.learn.openingsHeading')}
            items={OPENING_LESSONS.map((l) => ({
              id: l.id,
              label: t(`games.chess.learn.openings.${l.id}.name`),
            }))}
            currentId={opening.id}
          />
          <OpeningLesson
            key={opening.id}
            lesson={opening}
            t={t}
            animate={!reduced}
            onComplete={markDone}
            lang={locale}
          />
        </div>
      )}
      {!piece && !opening && <p>{t('games.chess.learn.notFound')}</p>}
    </div>
  );
}
