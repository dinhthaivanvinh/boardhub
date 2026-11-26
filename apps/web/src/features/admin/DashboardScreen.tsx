'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { spanDays, type AdminActivity, type AdminOverview } from '@bg/protocol';
import { lessonName } from '@/features/learn/lesson-name';
import { adminOverview } from '@/online/admin-api';
import { SERIES, RankBars, TimeChart } from './ui/charts';
import { ErrorLine, Loading, PageHeader, Panel, useLoad } from './ui/common';
import { initialRange, RangeFilter } from './ui/RangeFilter';
import { StatCard } from './ui/StatCard';

/** Lessons shown in the completion chart; the rest are in the table under it. */
const TOP_LESSONS = 10;

/** /admin: the health of the site over a range of days, all of it from stored data (docs/05 §2.1). */
export function DashboardScreen() {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  const [choice, setChoice] = useState(() => initialRange('d14'));
  const load = useCallback(() => adminOverview(choice.range), [choice]);
  const { data, error, loading, reload } = useLoad(load);

  return (
    <>
      <PageHeader title={t('title')}>
        <button type="button" className="btn" onClick={() => void reload()} disabled={loading}>
          {t('refresh')}
        </button>
      </PageHeader>
      <RangeFilter value={choice} onChange={setChoice} />
      <ErrorLine code={error} onRetry={() => void reload()} />
      {!data ? (
        !error && <Loading />
      ) : (
        <div className="admin-stack" data-loading={loading} data-testid="admin-dashboard">
          <p className="admin-muted">
            {t('period', {
              from: format.dateTime(new Date(`${data.range.from}T12:00:00+07:00`), { dateStyle: 'medium' }),
              to: format.dateTime(new Date(`${data.range.to}T12:00:00+07:00`), { dateStyle: 'medium' }),
              days: spanDays(data.range),
            })}
          </p>
          <Cards data={data} />
          <LearningNote data={data} />
          <Charts data={data} />
          <Recent items={data.recent} />
          <Definitions />
        </div>
      )}
    </>
  );
}

function Cards({ data }: { data: AdminOverview }) {
  const t = useTranslations('admin.dashboard.cards');
  const accounts = [
    ['all', 'users', 'totalUsers'],
    ['registered', 'account', 'registered'],
    ['guest', 'guest', 'guests'],
  ] as const;
  // Learning numbers of a range that ended before recording started are unknown, not zero.
  const recorded = data.learningSince !== null && data.range.to >= data.learningSince;
  const learned = (value: number) => (recorded ? value : null);

  return (
    <div className="admin-cards">
      {accounts.map(([key, icon, label]) => (
        <StatCard
          key={key}
          icon={icon}
          label={t(label)}
          value={data.accounts[key].total}
          note={t('added', { count: data.accounts[key].added.value })}
          compared={data.accounts[key].added}
          testId={`card-${label}`}
        />
      ))}
      <StatCard
        icon="active"
        label={t('learners')}
        value={learned(data.learners.value)}
        note={t('learnersNote')}
        compared={data.learners}
        testId="card-learners"
      />
      <StatCard
        icon="lessons"
        label={t('lessons')}
        value={data.lessonsTotal}
        note={t('lessonsNote')}
        testId="card-lessons"
      />
      <StatCard
        icon="done"
        label={t('completed')}
        value={learned(data.completedLessons.value)}
        note={t('saved', { count: data.completedLessons.saved })}
        compared={data.completedLessons}
        testId="card-completed"
      />
      <StatCard
        icon="chess"
        label={t('chess')}
        value={data.chess.total}
        note={t('added', { count: data.chess.started.value })}
        compared={data.chess.started}
        testId="card-chess"
      />
      <StatCard
        icon="puzzle"
        label={t('puzzles')}
        value={learned(data.solvedPuzzles.value)}
        note={t('saved', { count: data.solvedPuzzles.saved })}
        compared={data.solvedPuzzles}
        testId="card-puzzles"
      />
    </div>
  );
}

function LearningNote({ data }: { data: AdminOverview }) {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  return (
    <p className="admin-note-box" data-testid="learning-since">
      {data.learningSince === null
        ? t('learningNone')
        : t('learningSince', {
            day: format.dateTime(new Date(`${data.learningSince}T12:00:00+07:00`), { dateStyle: 'medium' }),
          })}
    </p>
  );
}

function Charts({ data }: { data: AdminOverview }) {
  const t = useTranslations('admin.dashboard.charts');
  const root = useTranslations();
  const days = data.days.map((d) => d.day);
  const lessons = data.lessons.map((l) => ({
    key: l.itemId,
    label: lessonName(l.itemId, root),
    value: l.learners,
  }));

  return (
    <div className="admin-charts">
      <Panel title={t('users')} hint={t('usersHint')}>
        <TimeChart
          title={t('users')}
          days={days}
          kind="line"
          series={[
            {
              key: 'registered',
              label: t('registered'),
              color: SERIES[0],
              values: data.days.map((d) => d.registered),
            },
            { key: 'guest', label: t('guest'), color: SERIES[1], values: data.days.map((d) => d.guest) },
          ]}
        />
      </Panel>
      <Panel title={t('learning')} hint={t('learningHint')}>
        <TimeChart
          title={t('learning')}
          days={days}
          kind="stack"
          series={(['lesson', 'practice', 'puzzle'] as const).map((kind, i) => ({
            key: kind,
            label: t(kind),
            color: SERIES[i]!,
            values: data.days.map((d) => d[kind]),
          }))}
          extra={[{ label: t('learners'), values: data.days.map((d) => d.learners) }]}
        />
      </Panel>
      <Panel title={t('completion')} hint={t('completionHint')}>
        {lessons.length === 0 ? (
          <p className="admin-empty">{t('completionEmpty')}</p>
        ) : (
          <>
            <RankBars rows={lessons.slice(0, TOP_LESSONS)} unit={t('children')} />
            {lessons.length > TOP_LESSONS && (
              <details className="admin-chart-table">
                <summary>{t('more', { count: lessons.length - TOP_LESSONS })}</summary>
                <RankBars rows={lessons.slice(TOP_LESSONS)} unit={t('children')} />
              </details>
            )}
          </>
        )}
      </Panel>
      <Panel title={t('chess')} hint={t('chessHint')}>
        <TimeChart
          title={t('chess')}
          days={days}
          kind="stack"
          series={[
            { key: 'chess', label: t('games'), color: SERIES[0], values: data.days.map((d) => d.chessGames) },
          ]}
        />
      </Panel>
    </div>
  );
}

function Recent({ items }: { items: AdminActivity[] }) {
  const t = useTranslations('admin.dashboard.recent');
  const root = useTranslations();
  const format = useFormatter();

  const text = (a: AdminActivity): string => {
    switch (a.type) {
      case 'signup':
        return t(`signup.${a.kind}`, { name: a.name });
      case 'match': {
        const game = root.has(`games.${a.gameId}.name`) ? root(`games.${a.gameId}.name`) : a.gameId;
        return t('match', { game, players: a.players.map((p) => p ?? t('bot')).join(' – ') });
      }
      case 'report':
        return t('report', { name: a.name, reason: root(`report.reasons.${a.reason}`) });
      case 'learn': {
        const name = a.name ?? t('visitor');
        if (a.kind === 'puzzle') return t('puzzle', { name, item: a.itemId });
        const item = lessonName(a.itemId.replace(/^practice-/, ''), root);
        return t(a.kind, { name, item });
      }
    }
  };

  return (
    <Panel title={t('title')} hint={t('hint')}>
      {items.length === 0 ? (
        <p className="admin-empty">{t('empty')}</p>
      ) : (
        <ul className="admin-activity" data-testid="admin-recent">
          {items.map((a, i) => (
            <li key={`${a.at}-${i}`} data-type={a.type}>
              <span>{text(a)}</span>
              <time dateTime={new Date(a.at).toISOString()}>
                {format.dateTime(a.at, { dateStyle: 'short', timeStyle: 'short' })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Definitions() {
  const t = useTranslations('admin.dashboard.defs');
  return (
    <details className="card admin-defs">
      <summary>{t('title')}</summary>
      <dl>
        {(['accounts', 'learners', 'completed', 'puzzles', 'chess', 'compare'] as const).map((key) => (
          <div key={key}>
            <dt>{t(`${key}.term`)}</dt>
            <dd>{t(`${key}.text`)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
