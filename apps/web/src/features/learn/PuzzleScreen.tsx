'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  dailyPuzzle,
  MateRoundView,
  nextPuzzle,
  PUZZLE_TIERS,
  puzzlesOfTier,
  useVoice,
  type Puzzle,
  type PuzzleTier,
} from '@bg/game-chess';
import { BoardStage } from '@/components/BoardStage';
import { LearnStats, useLearnStats } from './LearnStats';
import { useMarkPuzzle } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

type View = { kind: 'menu' } | { kind: 'daily' } | { kind: 'tier'; tier: PuzzleTier; id: string };

/** The puzzles page: the puzzle of the day, three levels, and the board for the puzzle being solved. */
export function PuzzleScreen({ startDaily = false }: { startDaily?: boolean }) {
  const [view, setView] = useState<View>(startDaily ? { kind: 'daily' } : { kind: 'menu' });
  const { puzzles, today } = useLearnStats();
  const solved = new Set(puzzles.solved);

  if (view.kind === 'menu') {
    return (
      <Menu
        today={today}
        solved={solved}
        dailyDone={puzzles.daily.includes(today)}
        onDaily={() => setView({ kind: 'daily' })}
        onTier={(tier) => {
          const first = nextPuzzle(tier, solved) ?? puzzlesOfTier(tier)[0]!;
          setView({ kind: 'tier', tier, id: first.id });
        }}
      />
    );
  }
  if (view.kind === 'daily') {
    if (!today) return <div className="puzzle-wait" aria-busy="true" />;
    return (
      <Play
        key={`d-${today}`}
        puzzle={dailyPuzzle(today)}
        daily
        today={today}
        onMenu={() => setView({ kind: 'menu' })}
      />
    );
  }
  const list = puzzlesOfTier(view.tier);
  const puzzle = list.find((p) => p.id === view.id) ?? list[0]!;
  return (
    <Play
      key={puzzle.id}
      puzzle={puzzle}
      tier={view.tier}
      position={`${list.indexOf(puzzle) + 1}/${list.length}`}
      today={today}
      solved={solved}
      onMenu={() => setView({ kind: 'menu' })}
      onNext={(id) => setView({ kind: 'tier', tier: view.tier, id })}
    />
  );
}

function Menu({
  today,
  solved,
  dailyDone,
  onDaily,
  onTier,
}: {
  today: string;
  solved: ReadonlySet<string>;
  dailyDone: boolean;
  onDaily(): void;
  onTier(tier: PuzzleTier): void;
}) {
  const t = useTranslations('games.chess.learn');
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
      <header className="puzzle-head">
        <h1 className="puzzle-title">
          <span aria-hidden="true">🧩</span> {t('puzzles.title')}
        </h1>
        <p className="mt-1 text-[var(--muted)]">{t('puzzles.subtitle')}</p>
        <LearnStats className="mt-3" />
      </header>

      <section className="card puzzle-daily" aria-labelledby="puzzle-daily-title">
        <span className="puzzle-daily-icon" aria-hidden="true">
          {dailyDone ? '✅' : '🌞'}
        </span>
        <div className="puzzle-daily-body">
          <h2 id="puzzle-daily-title" className="text-lg font-extrabold">
            {t('puzzles.daily.title')}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {dailyDone ? t('puzzles.daily.done') : t('puzzles.daily.text')}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!today}
          onClick={onDaily}
          data-testid="puzzle-daily"
        >
          {dailyDone ? t('puzzles.daily.again') : t('puzzles.daily.play')}
        </button>
      </section>

      <section aria-labelledby="puzzle-tiers">
        <h2 id="puzzle-tiers" className="text-xl font-bold">
          {t('puzzles.tiersHeading')}
        </h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {PUZZLE_TIERS.map((tier) => {
            const list = puzzlesOfTier(tier);
            const n = list.filter((p) => solved.has(p.id)).length;
            const all = n === list.length;
            return (
              <li key={tier} className="card puzzle-tier" data-i={tier - 1}>
                <h3 className="puzzle-tier-name">{t(`puzzles.tier.${tier}.name`)}</h3>
                <p className="text-sm text-[var(--muted)]">{t(`puzzles.tier.${tier}.text`)}</p>
                <div
                  className="puzzle-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={list.length}
                  aria-valuenow={n}
                >
                  <span style={{ width: `${(n / list.length) * 100}%` }} />
                </div>
                <p className="text-sm font-semibold">{t('puzzles.solved', { n, total: list.length })}</p>
                <button
                  type="button"
                  className="btn btn-primary mt-auto"
                  onClick={() => onTier(tier)}
                  data-testid={`puzzle-tier-${tier}`}
                >
                  {all ? t('puzzles.replay') : n > 0 ? t('puzzles.continue') : t('puzzles.start')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p>
        <Link href="/journey" className="btn">
          <span aria-hidden="true">🗺️</span> {t('journey.home.map')}
        </Link>
      </p>
    </div>
  );
}

/** One puzzle on the board. A right answer gives the star and offers the next puzzle. */
function Play({
  puzzle,
  daily = false,
  tier,
  position,
  today,
  solved,
  onMenu,
  onNext,
}: {
  puzzle: Puzzle;
  daily?: boolean;
  tier?: PuzzleTier;
  position?: string;
  today: string;
  solved?: ReadonlySet<string>;
  onMenu(): void;
  onNext?(id: string): void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const reduced = useReducedMotion();
  const voice = useVoice(locale);
  const mark = useMarkPuzzle();
  const [won, setWon] = useState(false);
  const c = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.checkmate.${key}`, values);
  const L = 'games.chess.learn.puzzles';

  const upcoming = tier && solved ? nextPuzzle(tier, new Set([...solved, puzzle.id]), puzzle.id) : null;
  const label = daily ? t(`${L}.todayLabel`) : t(`${L}.levelLabel`, { name: t(`${L}.tier.${tier}.name`) });

  const after = (
    <div className="puzzle-after" role="status" data-testid="puzzle-after">
      <p className="puzzle-reward">
        <span aria-hidden="true">⭐</span> {t(`${L}.reward`)}
      </p>
      <div className="ch-learn-actions">
        {upcoming && onNext ? (
          <button type="button" className="btn btn-primary ch-next" onClick={() => onNext(upcoming.id)}>
            {t(`${L}.next`)}
          </button>
        ) : (
          <p className="ch-learn-text">{tier ? t(`${L}.tierDone`) : t(`${L}.daily.done`)}</p>
        )}
        <button type="button" className="btn" onClick={onMenu}>
          {t(`${L}.back`)}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="stage-screen mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
    >
      <BoardStage />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="stage-aside min-w-0">
          <section className="ch-learn" aria-label={label}>
            <header className="ch-learn-header">
              <h1 className="ch-learn-title">
                <span aria-hidden="true">🧩</span> {label}
              </h1>
              <button type="button" className="btn ch-back" onClick={onMenu}>
                <span aria-hidden="true">←</span> {t(`${L}.back`)}
              </button>
            </header>
            <MateRoundView
              round={{ fen: puzzle.fen }}
              progress={daily ? '🌞' : (position ?? '')}
              t={t}
              c={c}
              animate={!reduced}
              voice={voice}
              delay={1400}
              onSolved={() => {
                setWon(true);
                if (today) mark(puzzle.id, today, daily);
              }}
              after={won ? after : undefined}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
