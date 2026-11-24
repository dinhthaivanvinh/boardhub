'use client';

import { BoardStage } from '@/components/BoardStage';
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

type NavGroup = { heading: string; ids: string[] };

/** Every lesson, grouped in the order they are meant to be taken: one menu to jump to any of them. */
function LessonNav({ currentId }: { currentId: string }) {
  const t = useTranslations();
  const done = useDoneLessons();
  const L = 'games.chess.learn';
  const groups: NavGroup[] = [
    { heading: t(`${L}.groupStart`), ids: [COORDINATES_LESSON_ID] },
    { heading: t(`${L}.piecesHeading`), ids: PIECE_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.groupRules`), ids: [CAPTURE_LESSON_ID, CHECKMATE_LESSON_ID] },
    { heading: t(`${L}.openingsHeading`), ids: OPENING_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.specialsHeading`), ids: SPECIAL_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.groupTactics`), ids: [TACTICS_LESSON_ID] },
  ];
  return (
    <nav
      aria-label={t(`${L}.allLessons`)}
      className="md:sticky md:top-20 md:max-h-full md:self-start md:overflow-y-auto"
    >
      <Link href="/" className="mb-2 hidden text-sm underline-offset-4 hover:underline md:block">
        ← {t(`${L}.backToHome`)}
      </Link>
      <div className="flex gap-4 overflow-x-auto pb-1 md:flex-col md:gap-3 md:overflow-visible">
        {groups.map((group, g) => (
          <section
            key={group.heading}
            aria-label={group.heading}
            data-g={g}
            className="flex shrink-0 gap-2 md:block"
          >
            <h2 className="mb-1 hidden text-xs font-semibold tracking-wide text-[var(--muted)] uppercase md:block">
              {group.heading}
            </h2>
            <ul className="flex gap-2 md:flex-col md:gap-1.5">
              {group.ids.map((id) => {
                const current = id === currentId;
                return (
                  <li key={id} className="shrink-0">
                    <Link
                      href={`/learn/chess/${id}`}
                      aria-current={current ? 'page' : undefined}
                      className="lesson-link flex items-center justify-between gap-2 text-sm whitespace-nowrap md:whitespace-normal"
                    >
                      <span>{lessonName(id, t)}</span>
                      {done.has(id) && <span aria-label={t(`${L}.completed`)}>✓</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <VoiceCredit className="mt-3 hidden md:block" />
    </nav>
  );
}

function VoiceCredit({ className }: { className: string }) {
  const t = useTranslations();
  return (
    <p className={`text-xs text-[var(--muted)] ${className}`}>
      {t('games.chess.learn.voiceCredit')}{' '}
      <a
        className="underline underline-offset-2"
        href="https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus"
        target="_blank"
        rel="noreferrer"
      >
        {t('games.chess.learn.voiceCreditLink')}
      </a>
      .
    </p>
  );
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
      className="stage-screen mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
      style={{ '--ch-nav': '15rem' } as React.CSSProperties}
    >
      <BoardStage />
      <Link href="/" className="text-sm underline-offset-4 hover:underline md:hidden">
        ← {t('games.chess.learn.backToHome')}
      </Link>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
        <LessonNav currentId={lessonId} />
        <div className="stage-aside min-w-0">
          {piece && (
            <PieceLesson
              key={piece.id}
              lesson={piece}
              t={t}
              animate={!reduced}
              onComplete={markDone}
              lang={locale}
              footer={footer}
            />
          )}
          {opening && (
            <OpeningLesson
              key={opening.id}
              lesson={opening}
              t={t}
              animate={!reduced}
              onComplete={markDone}
              lang={locale}
              footer={footer}
            />
          )}
          {special && (
            <SpecialLesson
              key={special.id}
              lesson={special}
              t={t}
              animate={!reduced}
              onComplete={markDone}
              lang={locale}
              footer={footer}
            />
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
        </div>
      </div>
      <VoiceCredit className="mt-2 md:hidden" />
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
