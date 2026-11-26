'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  dailyPuzzle,
  MateRoundView,
  nextIn,
  nextPuzzle,
  PUZZLE_TIERS,
  puzzlesOfKind,
  puzzlesOfTier,
  PuzzleRoundView,
  SKILL_KINDS,
  useVoice,
  type PuzzleTier,
  type SkillKind,
} from '@bg/game-chess';
import { BoardStage } from '@/components/BoardStage';
import { PageBanner } from '@/features/home/PageBanner';
import { LearnStats, useLearnStats } from './LearnStats';
import { useMarkPuzzle } from './use-progress';
import { useReducedMotion } from './use-reduced-motion';

type View =
  | { kind: 'menu' }
  | { kind: 'daily' }
  | { kind: 'tier'; tier: PuzzleTier; id: string }
  | { kind: 'skill'; skill: SkillKind; id: string };

const SKILL_ICON: Record<SkillKind, string> = { free: '🎁', save: '🛟', fork: '🍴', mate2: '🧠' };

/** The puzzles page: the puzzle of the day, the skills, three levels of mate in one, and the board in play. */
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
        onSkill={(skill) => {
          const list = puzzlesOfKind(skill);
          const first = nextIn(list, solved) ?? list[0]!;
          setView({ kind: 'skill', skill, id: first.id });
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
  const back = () => setView({ kind: 'menu' });
  const skill = view.kind === 'skill' ? view.skill : null;
  const list: readonly { id: string; fen: string }[] =
    view.kind === 'skill' ? puzzlesOfKind(view.skill) : puzzlesOfTier(view.tier);
  const puzzle = list.find((p) => p.id === view.id) ?? list[0]!;
  const upcoming = nextIn(list, new Set([...solved, puzzle.id]), puzzle.id);
  return (
    <Play
      key={puzzle.id}
      puzzle={puzzle}
      skill={skill}
      tier={view.kind === 'tier' ? view.tier : undefined}
      position={`${list.indexOf(puzzle) + 1}/${list.length}`}
      today={today}
      onMenu={back}
      next={
        upcoming
          ? () =>
              setView(
                view.kind === 'skill'
                  ? { kind: 'skill', skill: view.skill, id: upcoming.id }
                  : { kind: 'tier', tier: view.tier, id: upcoming.id },
              )
          : undefined
      }
    />
  );
}

function Menu({
  today,
  solved,
  dailyDone,
  onDaily,
  onTier,
  onSkill,
}: {
  today: string;
  solved: ReadonlySet<string>;
  dailyDone: boolean;
  onDaily(): void;
  onTier(tier: PuzzleTier): void;
  onSkill(skill: SkillKind): void;
}) {
  const t = useTranslations('games.chess.learn');
  return (
    <div className="adv-page mx-auto grid max-w-5xl gap-6 px-4 py-6">
      <PageBanner title={t('puzzles.title')} subtitle={t('puzzles.subtitle')} mascot="mascot-thinking.webp">
        <LearnStats className="mt-3" />
      </PageBanner>

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

      <section aria-labelledby="puzzle-skills">
        <h2 id="puzzle-skills" className="text-xl font-bold">
          {t('puzzles.kindsHeading')}
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SKILL_KINDS.map((kind, i) => {
            const list = puzzlesOfKind(kind);
            const n = list.filter((p) => solved.has(p.id)).length;
            return (
              <li key={kind} className="card puzzle-tier" data-i={i % 3}>
                <h3 className="puzzle-tier-name">
                  <span aria-hidden="true">{SKILL_ICON[kind]}</span> {t(`puzzles.kinds.${kind}.name`)}
                </h3>
                <p className="text-sm text-[var(--muted)]">{t(`puzzles.kinds.${kind}.text`)}</p>
                <Progress n={n} total={list.length} label={t(`puzzles.kinds.${kind}.name`)} />
                <p className="text-sm font-semibold">{t('puzzles.solved', { n, total: list.length })}</p>
                <button
                  type="button"
                  className="btn btn-primary mt-auto"
                  onClick={() => onSkill(kind)}
                  data-testid={`puzzle-kind-${kind}`}
                >
                  {n === list.length
                    ? t('puzzles.replay')
                    : n > 0
                      ? t('puzzles.continue')
                      : t('puzzles.start')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="puzzle-tiers">
        <h2 id="puzzle-tiers" className="text-xl font-bold">
          {t('puzzles.mate1Heading')}
        </h2>
        <p className="text-sm text-[var(--muted)]">{t('puzzles.tiersHeading')}</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {PUZZLE_TIERS.map((tier) => {
            const list = puzzlesOfTier(tier);
            const n = list.filter((p) => solved.has(p.id)).length;
            const all = n === list.length;
            return (
              <li key={tier} className="card puzzle-tier" data-i={tier - 1}>
                <h3 className="puzzle-tier-name">{t(`puzzles.tier.${tier}.name`)}</h3>
                <p className="text-sm text-[var(--muted)]">{t(`puzzles.tier.${tier}.text`)}</p>
                <Progress n={n} total={list.length} label={t(`puzzles.tier.${tier}.name`)} />
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

      <p className="flex flex-wrap gap-3">
        <Link href="/journey" className="btn">
          {t('journey.home.map')}
        </Link>
        <Link href="/mini-games" className="btn">
          <span aria-hidden="true">🎲</span> {t('mini.title')}
        </Link>
      </p>
    </div>
  );
}

function Progress({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div
      className="puzzle-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={n}
    >
      <span style={{ width: `${(n / total) * 100}%` }} />
    </div>
  );
}

/** One puzzle on the board. A right answer gives the star and offers the next puzzle. */
function Play({
  puzzle,
  daily = false,
  skill = null,
  tier,
  position,
  today,
  onMenu,
  next,
}: {
  puzzle: { id: string; fen: string };
  daily?: boolean;
  /** Set for a skill puzzle; otherwise it is a mate in one. */
  skill?: SkillKind | null;
  tier?: PuzzleTier | undefined;
  position?: string;
  today: string;
  onMenu(): void;
  /** Goes to the next unsolved puzzle of the same list, when there is one. */
  next?: (() => void) | undefined;
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
  /** Texts of a skill puzzle: "free.prompt", or "illegal" for all of them. */
  const k = (key: string, values?: Record<string, string | number>) => t(`${L}.kinds.${key}`, values);

  const label = daily
    ? t(`${L}.todayLabel`)
    : skill
      ? k(`${skill}.name`)
      : t(`${L}.levelLabel`, { name: t(`${L}.tier.${tier}.name`) });

  const after = (
    <div className="puzzle-after" role="status" data-testid="puzzle-after">
      <p className="puzzle-reward">
        <span aria-hidden="true">⭐</span> {t(`${L}.reward`)}
      </p>
      <div className="ch-learn-actions">
        {next ? (
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {t(`${L}.next`)}
          </button>
        ) : (
          <p className="ch-learn-text">{daily ? t(`${L}.daily.done`) : t(`${L}.tierDone`)}</p>
        )}
        <button type="button" className="btn" onClick={onMenu}>
          {t(`${L}.back`)}
        </button>
      </div>
    </div>
  );

  const shared = {
    progress: daily ? '🌞' : (position ?? ''),
    t,
    animate: !reduced,
    voice,
    delay: 1400,
    onSolved: () => {
      setWon(true);
      if (today) mark(puzzle.id, today, daily);
    },
    after: won ? after : undefined,
  };

  return (
    <div
      className="stage-screen lesson-scene mx-auto grid max-w-[90rem] grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-rows-[minmax(0,1fr)]"
      data-game="chess"
    >
      <BoardStage />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] gap-3">
        <div className="stage-aside min-w-0">
          <section className="ch-learn" aria-label={label}>
            <header className="ch-learn-header">
              <h1 className="ch-learn-title">{label}</h1>
              <button type="button" className="btn ch-back" onClick={onMenu}>
                <span aria-hidden="true">←</span> {t(`${L}.back`)}
              </button>
            </header>
            {skill ? (
              <PuzzleRoundView {...shared} round={{ kind: skill, fen: puzzle.fen }} c={k} />
            ) : (
              <MateRoundView {...shared} round={{ fen: puzzle.fen }} c={c} spokenInParts />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
