'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  CAPTURE_LESSON_ID,
  CaptureLesson,
  CHECKMATE_LESSON_ID,
  CheckmateLesson,
  COORDINATES_LESSON_ID,
  CoordinatesLesson,
  OPENING_LESSONS,
  OpeningLesson,
  openingLesson,
  PIECE_LESSONS,
  PieceLesson,
  pieceLesson,
  SPECIAL_LESSONS,
  SpecialLesson,
  specialLesson,
  TACTICS_LESSON_ID,
  TacticsLesson,
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

/** The order the lessons are meant to be taken in (the home page path). */
const ORDER: string[] = [
  COORDINATES_LESSON_ID,
  ...PIECE_LESSONS.map((l) => l.id),
  CAPTURE_LESSON_ID,
  CHECKMATE_LESSON_ID,
  ...OPENING_LESSONS.map((l) => l.id),
  ...SPECIAL_LESSONS.map((l) => l.id),
  TACTICS_LESSON_ID,
];

function lessonName(id: string, t: ReturnType<typeof useTranslations>): string {
  const piece = pieceLesson(id);
  if (piece) return t(`games.chess.pieceNames.${piece.piece}`);
  if (openingLesson(id)) return t(`games.chess.learn.openings.${id}.name`);
  if (specialLesson(id)) return t(`games.chess.learn.specials.${id}.name`);
  return t(`games.chess.learn.${id}.name`);
}

/** The big button at the end of a lesson: on to the next one, or on to playing after the last. */
function NextLessonLink({ lessonId }: { lessonId: string }) {
  const t = useTranslations();
  const next = ORDER[ORDER.indexOf(lessonId) + 1];
  return next ? (
    <Link href={`/learn/chess/${next}`} className="btn btn-primary ch-next">
      {t('games.chess.learn.nextLesson', { name: lessonName(next, t) })}
    </Link>
  ) : (
    <Link href="/games/chess" className="btn btn-primary ch-next">
      {t('games.chess.learn.playChess')}
    </Link>
  );
}

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const markDone = useMarkDone();
  const piece = pieceLesson(lessonId);
  const opening = openingLesson(lessonId);
  const special = specialLesson(lessonId);
  const footer = <NextLessonLink lessonId={lessonId} />;
  return (
    <div
      className="mx-auto grid max-w-6xl gap-3 px-4 py-4"
      data-game="chess"
      style={piece || opening || special ? ({ '--ch-nav': '15rem' } as React.CSSProperties) : undefined}
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
            footer={footer}
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
            footer={footer}
          />
        </div>
      )}
      {special && (
        <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <LessonNav
            heading={t('games.chess.learn.specialsHeading')}
            items={SPECIAL_LESSONS.map((l) => ({
              id: l.id,
              label: t(`games.chess.learn.specials.${l.id}.name`),
            }))}
            currentId={special.id}
          />
          <SpecialLesson
            key={special.id}
            lesson={special}
            t={t}
            animate={!reduced}
            onComplete={markDone}
            lang={locale}
            footer={footer}
          />
        </div>
      )}
      {lessonId === COORDINATES_LESSON_ID && (
        <CoordinatesLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
      )}
      {lessonId === TACTICS_LESSON_ID && (
        <TacticsLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
      )}
      {lessonId === CAPTURE_LESSON_ID && (
        <CaptureLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
      )}
      {lessonId === CHECKMATE_LESSON_ID && (
        <CheckmateLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
      )}
      {!piece &&
        !opening &&
        !special &&
        lessonId !== COORDINATES_LESSON_ID &&
        lessonId !== CHECKMATE_LESSON_ID &&
        lessonId !== CAPTURE_LESSON_ID &&
        lessonId !== TACTICS_LESSON_ID && <p>{t('games.chess.learn.notFound')}</p>}
    </div>
  );
}
