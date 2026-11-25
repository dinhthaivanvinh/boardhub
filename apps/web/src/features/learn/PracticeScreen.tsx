'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { JOURNEY_LESSONS, PracticeLesson } from '@bg/game-chess';
import { BoardStage } from '@/components/BoardStage';
import { lessonName } from './lesson-name';
import { useMarkDone } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

/** The practice of one lesson: five short questions on what it taught, then a star. */
export function PracticeScreen({ lessonId }: { lessonId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const markDone = useMarkDone();
  const next = JOURNEY_LESSONS[JOURNEY_LESSONS.indexOf(lessonId) + 1];
  const L = 'games.chess.learn';

  const footer = (
    <>
      <Link href={`/learn/chess/${lessonId}`} className="btn ch-next" data-testid="practice-back">
        <span aria-hidden="true">←</span> {t(`${L}.practice.toLesson`)}
      </Link>
      <Link
        href={next ? `/learn/chess/${next}` : '/games/chess'}
        className="btn btn-primary ch-next"
        data-testid="practice-next"
      >
        {next ? t(`${L}.nextLesson`, { name: lessonName(next, t) }) : t(`${L}.playChess`)}
      </Link>
    </>
  );

  return (
    <div
      className="stage-screen mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
    >
      <BoardStage />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="stage-aside min-w-0">
          <PracticeLesson
            lessonId={lessonId}
            lessonName={lessonName(lessonId, t)}
            t={t}
            animate={!reduced}
            lang={locale}
            onComplete={markDone}
            footer={footer}
          />
        </div>
      </div>
    </div>
  );
}
