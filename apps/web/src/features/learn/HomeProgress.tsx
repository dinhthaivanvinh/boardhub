'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { nextLessonId, PieceGlyph } from '@bg/game-chess';
import { lessonName } from './lesson-name';
import { LearnStats, useLearnStats } from './LearnStats';
import { SaveProgress } from './SaveProgress';

/** The home page's helper: a little knight says what to do today, with one big button to do it. */
export function HomeProgress() {
  const t = useTranslations();
  const L = 'games.chess.learn.journey.home';
  const { done, puzzles, today } = useLearnStats();
  const next = nextLessonId(done);
  const started = done.size > 0 || puzzles.solved.length > 0;
  const dailyDone = puzzles.daily.includes(today);

  const line = !started
    ? t(`${L}.newcomer`)
    : next
      ? t(`${L}.next`, { lesson: lessonName(next, t) })
      : t(`${L}.allDone`);

  return (
    <section className="card home-helper" aria-labelledby="home-helper-title" data-testid="home-helper">
      <div className="home-helper-mascot" aria-hidden="true" data-game="chess">
        <PieceGlyph piece="bN" size={72} />
      </div>
      <div className="home-helper-body">
        <h2 id="home-helper-title" className="home-helper-title">
          {t(`${L}.title`)}
        </h2>
        <p className="home-helper-bubble" data-testid="home-helper-line">
          {line}
        </p>
        {started && (
          <p className="text-sm font-semibold">{dailyDone ? t(`${L}.dailyDone`) : t(`${L}.dailyPending`)}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {next ? (
            <Link href={`/learn/chess/${next}`} className="btn btn-primary btn-lg" data-testid="helper-learn">
              <span aria-hidden="true">🎓</span> {started ? t(`${L}.continue`) : t(`${L}.start`)}
            </Link>
          ) : null}
          <Link
            href="/puzzles/daily"
            className={`btn btn-lg ${next ? '' : 'btn-primary'}`}
            data-testid="helper-puzzle"
          >
            <span aria-hidden="true">🧩</span> {t(`${L}.puzzle`)}
          </Link>
          <Link href="/journey" className="btn btn-lg" data-testid="helper-journey">
            <span aria-hidden="true">🗺️</span> {t(`${L}.map`)}
          </Link>
        </div>
      </div>
      <LearnStats className="home-helper-stats" />
      {started && (
        <div className="home-helper-save">
          <SaveProgress compact />
        </div>
      )}
    </section>
  );
}
