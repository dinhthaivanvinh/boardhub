'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { nextLessonId } from '@bg/game-chess';
import { useDoneLessons } from './use-progress';

/** The main "learn" button: it starts the first lesson, or carries on with the next lesson not done yet. */
export function LearnCta({ className, testId }: { className: string; testId?: string }) {
  const t = useTranslations('portal');
  const done = useDoneLessons();
  const next = nextLessonId(done);
  const started = done.size > 0;
  return (
    <Link href={`/learn/chess/${next ?? 'coordinates'}`} className={className} data-testid={testId}>
      {started && next ? t('ctaContinue') : t('ctaLearn')}
    </Link>
  );
}
