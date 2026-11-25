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
  DRAWS_LESSON_ID,
  DrawsLesson,
  SETUP_LESSON_ID,
  SetupLesson,
  OPENING_LESSONS,
  OpeningLesson,
  openingLesson,
  PIECE_LESSONS,
  PieceLesson,
  PRACTICE_LESSON_IDS,
  practiceId,
  pieceLesson,
  SPECIAL_LESSONS,
  SpecialLesson,
  specialLesson,
  TACTICS_LESSON_ID,
  TacticsLesson,
} from '@bg/game-chess';
import { lessonName } from './lesson-name';
import { useDoneLessons, useMarkDone } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

/** The order the lessons are meant to be taken in (the home page path). */
const ORDER: string[] = [
  COORDINATES_LESSON_ID,
  SETUP_LESSON_ID,
  ...PIECE_LESSONS.map((l) => l.id),
  CAPTURE_LESSON_ID,
  CHECKMATE_LESSON_ID,
  DRAWS_LESSON_ID,
  ...OPENING_LESSONS.map((l) => l.id),
  ...SPECIAL_LESSONS.map((l) => l.id),
  TACTICS_LESSON_ID,
];

type NavGroup = { heading: string; ids: string[] };

/** A small picture in front of each lesson and each group of the menu (decoration). */
const LESSON_ICON: Record<string, string> = {
  [COORDINATES_LESSON_ID]: '🧒',
  [SETUP_LESSON_ID]: '♟️',
  pawn: '♙',
  rook: '♖',
  bishop: '♗',
  knight: '♘',
  queen: '♕',
  king: '♔',
  [CAPTURE_LESSON_ID]: '🛡️',
  [CHECKMATE_LESSON_ID]: '🏁',
  [DRAWS_LESSON_ID]: '🤝',
  [TACTICS_LESSON_ID]: '🎯',
};
const GROUP_ICON = ['👑', '⭐', '📖', '🎓', '✨', '🎯'];
const iconOf = (id: string, group: number) =>
  LESSON_ICON[id] ?? (group === 3 ? '📖' : group === 4 ? '✨' : '•');

/** Every lesson, grouped in the order they are meant to be taken: one menu to jump to any of them. */
function LessonNav({ currentId }: { currentId: string }) {
  const t = useTranslations();
  const done = useDoneLessons();
  const L = 'games.chess.learn';
  const groups: NavGroup[] = [
    { heading: t(`${L}.groupStart`), ids: [COORDINATES_LESSON_ID, SETUP_LESSON_ID] },
    { heading: t(`${L}.piecesHeading`), ids: PIECE_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.groupRules`), ids: [CAPTURE_LESSON_ID, CHECKMATE_LESSON_ID, DRAWS_LESSON_ID] },
    { heading: t(`${L}.openingsHeading`), ids: OPENING_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.specialsHeading`), ids: SPECIAL_LESSONS.map((l) => l.id) },
    { heading: t(`${L}.groupTactics`), ids: [TACTICS_LESSON_ID] },
  ];
  return (
    <nav
      aria-label={t(`${L}.allLessons`)}
      className="md:sticky md:top-20 md:max-h-full md:self-start md:overflow-y-auto"
    >
      <Link href="/" className="lesson-back mb-2 hidden text-sm underline-offset-4 hover:underline md:block">
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
            <h2 className="lesson-group-title mb-1 hidden text-xs font-semibold tracking-wide uppercase md:flex">
              <span aria-hidden="true">{GROUP_ICON[g]}</span>
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
                      {id === COORDINATES_LESSON_ID ? (
                        <span className="lesson-icon" aria-hidden="true">
                          <span className="lesson-face" />
                        </span>
                      ) : (
                        <span className="lesson-icon" aria-hidden="true">
                          {iconOf(id, g)}
                        </span>
                      )}
                      <span className="lesson-link-name">{lessonName(id, t)}</span>
                      {done.has(id) ? (
                        <span className="lesson-done" aria-label={t(`${L}.completed`)}>
                          ✓
                        </span>
                      ) : (
                        <span className="lesson-chevron" aria-hidden="true">
                          ›
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

/** The big button at the end of a lesson: on to the next one, or on to playing after the last. */
function NextLessonLink({ lessonId, secondary = false }: { lessonId: string; secondary?: boolean }) {
  const t = useTranslations();
  const next = ORDER[ORDER.indexOf(lessonId) + 1];
  const look = secondary ? 'btn ch-next' : 'btn btn-primary ch-next';
  return next ? (
    <Link href={`/learn/chess/${next}`} className={look}>
      {t('games.chess.learn.nextLesson', { name: lessonName(next, t) })}
    </Link>
  ) : (
    <Link href="/games/chess" className={look}>
      {t('games.chess.learn.playChess')}
    </Link>
  );
}

/** Lessons whose practice is the puzzles: mating is what they teach. */
const PUZZLE_PRACTICE = [CHECKMATE_LESSON_ID, TACTICS_LESSON_ID];

/** What follows a finished lesson: its practice (the main button), then on to the next lesson. */
function LessonFooter({ lessonId }: { lessonId: string }) {
  const t = useTranslations('games.chess.learn.practice');
  const done = useDoneLessons();
  const hasPractice = PRACTICE_LESSON_IDS.includes(lessonId);
  const toPuzzles = PUZZLE_PRACTICE.includes(lessonId);
  return (
    <>
      {hasPractice && (
        <Link
          href={`/learn/chess/${lessonId}/practice`}
          className="btn btn-primary ch-next"
          data-testid="practice-link"
        >
          <span aria-hidden="true">💪</span> {done.has(practiceId(lessonId)) ? t('ctaDone') : t('cta')}
        </Link>
      )}
      {toPuzzles && (
        <Link href="/puzzles" className="btn btn-primary ch-next" data-testid="practice-puzzles-link">
          <span aria-hidden="true">🧩</span> {t('morePuzzles')}
        </Link>
      )}
      <NextLessonLink lessonId={lessonId} secondary={hasPractice || toPuzzles} />
    </>
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
  const footer = <LessonFooter lessonId={lessonId} />;
  return (
    <div
      className="stage-screen lesson-scene mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
      style={{ '--ch-nav': '15rem' } as React.CSSProperties}
    >
      <BoardStage />
      <div className="scene-decor" aria-hidden="true">
        <span className="scene-sign">{t('games.chess.learn.funSign')} ♥</span>
        <span className="scene-pawn" />
      </div>
      <Link href="/" className="text-sm underline-offset-4 hover:underline md:hidden">
        ← {t('games.chess.learn.backToHome')}
      </Link>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[14.5rem_minmax(0,1fr)]">
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
          {lessonId === SETUP_LESSON_ID && (
            <SetupLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
          )}
          {lessonId === DRAWS_LESSON_ID && (
            <DrawsLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
          )}
          {lessonId === CHECKMATE_LESSON_ID && (
            <CheckmateLesson t={t} animate={!reduced} onComplete={markDone} lang={locale} footer={footer} />
          )}
        </div>
      </div>
      {!piece &&
        !opening &&
        !special &&
        lessonId !== COORDINATES_LESSON_ID &&
        lessonId !== SETUP_LESSON_ID &&
        lessonId !== DRAWS_LESSON_ID &&
        lessonId !== CHECKMATE_LESSON_ID &&
        lessonId !== CAPTURE_LESSON_ID &&
        lessonId !== TACTICS_LESSON_ID && <p>{t('games.chess.learn.notFound')}</p>}
    </div>
  );
}
