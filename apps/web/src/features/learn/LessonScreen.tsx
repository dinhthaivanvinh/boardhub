'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { OpeningLesson, openingLesson, PieceLesson, pieceLesson } from '@bg/game-chess';
import { useMarkDone } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const markDone = useMarkDone();
  const piece = pieceLesson(lessonId);
  const opening = openingLesson(lessonId);
  return (
    <div className="mx-auto grid max-w-5xl gap-3 px-4 py-4" data-game="chess">
      <Link href="/learn/chess" className="text-sm underline-offset-4 hover:underline">
        ← {t('games.chess.learn.backToList')}
      </Link>
      {piece && <PieceLesson key={piece.id} lesson={piece} t={t} animate={!reduced} onComplete={markDone} />}
      {opening && (
        <OpeningLesson
          key={opening.id}
          lesson={opening}
          t={t}
          animate={!reduced}
          onComplete={markDone}
          lang={locale}
        />
      )}
      {!piece && !opening && <p>{t('games.chess.learn.notFound')}</p>}
    </div>
  );
}
