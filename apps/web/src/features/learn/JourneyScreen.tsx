'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  BADGES,
  earnedBadges,
  JOURNEY,
  nextLessonId,
  openingLesson,
  practiceId,
  PUZZLES,
} from '@bg/game-chess';
import { buildPlayUrl } from '@/game-runtime/match-setup';
import { lessonName } from './lesson-name';
import { PageBanner } from '@/features/home/PageBanner';
import { LearnStats, useLearnStats } from './LearnStats';
import { SaveProgress } from './SaveProgress';

/** The way of learning as a map: stages with their lessons, then puzzles and a real game, then the badges. */
export function JourneyScreen() {
  const t = useTranslations();
  const L = 'games.chess.learn.journey';
  const { done, puzzles, today, rank } = useLearnStats();
  const next = nextLessonId(done);
  const earned = new Set(earnedBadges(done, puzzles, today || '1970-01-01'));
  const solvedCount = new Set(puzzles.solved.filter((id) => PUZZLES.some((p) => p.id === id))).size;

  return (
    <div className="adv-page mx-auto grid max-w-5xl gap-6 px-4 py-6">
      <PageBanner title={t(`${L}.title`)} subtitle={t(`${L}.subtitle`)} mascot="mascot-pointing.webp">
        <LearnStats className="mt-3" />
        <p className="mt-2 text-sm font-semibold" data-testid="journey-next-rank">
          {rank.next
            ? t(`${L}.toNext`, { n: rank.toNext ?? 0, rank: t(`${L}.ranks.${rank.next.id}`) })
            : t(`${L}.topRank`)}
        </p>
      </PageBanner>

      <SaveProgress />

      <div className="journey-path">
        {next ? (
          <Link
            href={`/learn/chess/${next}`}
            className="btn btn-primary btn-lg journey-go"
            data-testid="journey-continue"
          >
            <span aria-hidden="true">▶</span> {t(`${L}.next`)}: {lessonName(next, t)}
          </Link>
        ) : (
          <p className="journey-all-done">{t(`${L}.allDone`)}</p>
        )}

        <ol className="journey-stages">
          {JOURNEY.map((stage, g) => (
            <li key={stage.id} className="card journey-stage" data-g={g}>
              <h2 className="journey-stage-title">
                <span className="journey-stage-number" aria-hidden="true">
                  {g + 1}
                </span>
                {t(`${L}.stage.${stage.id}`)}
              </h2>
              <ul className="journey-nodes">
                {stage.lessons.map((id) => {
                  const state = done.has(id) ? 'done' : id === next ? 'next' : 'todo';
                  return (
                    <li key={id}>
                      <Link href={`/learn/chess/${id}`} className="journey-node" data-state={state}>
                        <span className="journey-node-dot" aria-hidden="true">
                          {state === 'done' ? '⭐' : state === 'next' ? '▶' : '○'}
                        </span>
                        <span className="journey-node-name">
                          {lessonName(id, t)}
                          {openingLesson(id) && (
                            <span className="lesson-advanced"> {t('games.chess.learn.advanced')}</span>
                          )}
                        </span>
                        {state === 'done' && <span className="sr-only">{t(`${L}.done`)}</span>}
                        {done.has(practiceId(id)) && (
                          <span className="journey-node-practice" title={t(`${L}.practiceDone`)}>
                            <span className="sr-only">{t(`${L}.practiceDone`)}</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          <li className="card journey-stage" data-g={JOURNEY.length}>
            <h2 className="journey-stage-title">
              <span className="journey-stage-number" aria-hidden="true">
                🧩
              </span>
              {t(`${L}.puzzlesTitle`)}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t(`${L}.puzzlesText`)}</p>
            <p className="text-sm font-semibold">
              {t('games.chess.learn.puzzles.solved', { n: solvedCount, total: PUZZLES.length })}
            </p>
            <Link href="/puzzles" className="btn mt-2">
              {t(`${L}.go`)}
            </Link>
          </li>
          <li className="card journey-stage" data-g={JOURNEY.length + 1}>
            <h2 className="journey-stage-title">
              <span className="journey-stage-number" aria-hidden="true">
                🎈
              </span>
              {t('games.chess.learn.mini.title')}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t(`${L}.miniText`)}</p>
            <Link href="/mini-games" className="btn mt-2" data-testid="journey-mini">
              {t(`${L}.go`)}
            </Link>
          </li>
          <li className="card journey-stage" data-g={JOURNEY.length + 2}>
            <h2 className="journey-stage-title">
              <span className="journey-stage-number" aria-hidden="true">
                🎮
              </span>
              {t(`${L}.playTitle`)}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t(`${L}.playText`)}</p>
            <Link
              href={buildPlayUrl('chess', { mode: 'bot', level: 'easy', humanSeat: 0, config: {} })}
              className="btn mt-2"
              data-testid="journey-play-easy"
            >
              {t(`${L}.go`)}
            </Link>
          </li>
        </ol>
      </div>

      <section aria-labelledby="journey-badges">
        <h2 id="journey-badges" className="text-xl font-bold">
          {t(`${L}.badges`)}
        </h2>
        <p className="text-sm text-[var(--muted)]" data-testid="journey-badge-count">
          {t(`${L}.badgesCount`, { n: earned.size, total: BADGES.length })}
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((b, i) => {
            const got = earned.has(b.id);
            return (
              <li key={b.id} className="card journey-badge" data-earned={got} data-i={i % 6}>
                <span className="journey-badge-icon" aria-hidden="true">
                  {got ? b.icon : '🔒'}
                </span>
                <div>
                  <h3 className="font-bold">{t(`${L}.badge.${b.id}.name`)}</h3>
                  <p className="text-sm text-[var(--muted)]">{t(`${L}.badge.${b.id}.text`)}</p>
                  {!got && <span className="sr-only">{t(`${L}.locked`)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
