'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { daysOf, type AdminStats, type DateRange, type DayVisits } from '@bg/protocol';
import { adminStats } from '@/online/admin-api';
import { downloadCsv } from './csv';
import { SERIES, TimeChart } from './ui/charts';
import { ErrorLine, Loading, PageHeader, Panel, useLoad } from './ui/common';
import { initialRange, RangeFilter } from './ui/RangeFilter';
import { OpenButton, StatCard } from './ui/StatCard';
import { VisitorDialog, type VisitorFilter, type VisitorQuestion } from './VisitorDialog';

const KINDS = ['anonymous', 'guest', 'registered'] as const;
const COLUMNS = ['total', ...KINDS, 'sessions'] as const;

/** /admin/visitors: who came to the site, by day and over a range (docs/05 §2.1, daily_visits). */
export function VisitorsScreen() {
  const t = useTranslations('admin.stats');
  const [choice, setChoice] = useState(() => initialRange('d14'));
  const load = useCallback(() => adminStats(choice.range), [choice]);
  const { data, error, loading, reload } = useLoad(load);
  const [question, setQuestion] = useState<VisitorQuestion | null>(null);
  const ask: Ask = (range, filter) => setQuestion({ range, filter });

  return (
    <>
      <PageHeader title={t('title')}>
        <button type="button" className="btn" onClick={() => void reload()}>
          {t('refresh')}
        </button>
      </PageHeader>
      <ErrorLine code={error} onRetry={() => void reload()} />
      {!data ? (
        !error && <Loading />
      ) : (
        <div className="admin-stack" data-testid="admin-stats">
          <Today today={data.today} ask={ask} />
          <RangeFilter value={choice} onChange={setChoice} />
          <Range data={data} loading={loading} ask={ask} />
        </div>
      )}
      <Definitions />
      {question && <VisitorDialog question={question} onClose={() => setQuestion(null)} />}
    </>
  );
}

/** Opens the list of who is behind a number. */
type Ask = (range: DateRange, filter: VisitorFilter) => void;
const oneDay = (day: string): DateRange => ({ from: day, to: day });

function useDayText() {
  const format = useFormatter();
  return (value: string) => format.dateTime(new Date(`${value}T12:00:00+07:00`), { dateStyle: 'medium' });
}

/** Today's numbers, whatever range is chosen below. */
function Today({ today, ask }: { today: DayVisits; ask: Ask }) {
  const t = useTranslations('admin.stats');
  const format = useFormatter();
  const day = useDayText();
  return (
    <section aria-labelledby="stats-today" className="admin-stack">
      <h2 id="stats-today">
        {t('today')} · {day(today.day)}
      </h2>
      <p className="admin-muted">{t('who.hint')}</p>
      <div className="admin-cards">
        {(['total', ...KINDS] as const).map((k) => (
          <div
            key={k}
            className="card admin-stat"
            data-testid={k === 'total' ? 'stats-total' : `stats-today-${k}`}
          >
            <div className="admin-stat-head">{t(k)}</div>
            <div className="admin-stat-value">{format.number(today[k])}</div>
            <OpenButton label={t('who.open', { label: t(k) })} run={() => ask(oneDay(today.day), k)} />
          </div>
        ))}
      </div>
      <p className="admin-muted">{t('signedIn', { count: today.guest + today.registered })}</p>
    </section>
  );
}

function Range({ data, loading, ask }: { data: AdminStats; loading: boolean; ask: Ask }) {
  const t = useTranslations('admin.stats');
  const day = useDayText();
  const byDay = new Map(data.days.map((d) => [d.day, d]));
  const days = daysOf(data.range);
  // A day before the first stored visit is unknown, not zero.
  const known = (d: string) => data.since !== null && d >= data.since;
  const compared = (key: (typeof COLUMNS)[number]) => ({
    value: data.unique[key],
    previous: data.previous ? data.previous[key] : null,
  });
  const icons = {
    total: 'users',
    anonymous: 'guest',
    guest: 'account',
    registered: 'account',
    sessions: 'active',
  } as const;

  const exportCsv = () =>
    downloadCsv(`boardhub-visitors-${data.range.from}_${data.range.to}.csv`, [
      [t('day'), ...COLUMNS.map((c) => t(`columns.${c}`))],
      ...data.days.map((d) => [d.day, ...COLUMNS.map((c) => (known(d.day) ? d[c] : ''))]),
    ]);

  return (
    <div className="admin-stack" data-loading={loading}>
      <section aria-label={t('overRange')} className="admin-stack">
        <h2>{t('overRange')}</h2>
        <div className="admin-cards">
          {COLUMNS.map((key) => (
            <StatCard
              key={key}
              icon={icons[key]}
              label={t(`unique.${key}`)}
              value={data.unique[key]}
              compared={compared(key)}
              testId={`range-${key}-total`}
              {...(key !== 'sessions' && {
                open: {
                  label: t('who.open', { label: t(`unique.${key}`) }),
                  run: () => ask(data.range, key),
                },
              })}
            />
          ))}
        </div>
      </section>
      <Panel title={t('chart')} hint={t('chartHint')}>
        <TimeChart
          title={t('chart')}
          days={days}
          kind="stack"
          series={KINDS.map((k, i) => ({
            key: k,
            label: t(k),
            color: SERIES[i]!,
            values: days.map((d) => (known(d) ? (byDay.get(d)?.[k] ?? 0) : null)),
          }))}
          extra={[
            {
              label: t('columns.sessions'),
              values: days.map((d) => (known(d) ? (byDay.get(d)?.sessions ?? 0) : null)),
            },
          ]}
        />
      </Panel>
      <Panel
        title={t('days', { count: data.days.length })}
        hint={data.since ? t('since', { day: day(data.since) }) : t('none')}
        actions={
          <button type="button" className="btn" onClick={exportCsv} data-testid="stats-export">
            {t('export')}
          </button>
        }
      >
        <div className="admin-table-wrap admin-table-tall">
          <table className="admin-table" data-testid="stats-days">
            <thead>
              <tr>
                <th scope="col">{t('day')}</th>
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className="num">
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day}>
                  <th scope="row">{day(d.day)}</th>
                  {COLUMNS.map((c) => (
                    <td key={c} className="num">
                      {!known(d.day) ? (
                        '—'
                      ) : c !== 'sessions' && d[c] > 0 ? (
                        <button
                          type="button"
                          className="admin-link-button"
                          aria-haspopup="dialog"
                          aria-label={t('who.openDay', {
                            label: t(`columns.${c}`),
                            day: day(d.day),
                            count: d[c],
                          })}
                          onClick={() => ask(oneDay(d.day), c)}
                          data-testid={`day-${c}`}
                        >
                          {d[c]}
                        </button>
                      ) : (
                        d[c]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Definitions() {
  const t = useTranslations('admin.stats');
  return (
    <details className="card admin-defs">
      <summary>{t('defs.title')}</summary>
      <dl>
        {(['unique', 'sessions', 'anonymous', 'guest', 'registered'] as const).map((key) => (
          <div key={key}>
            <dt>{t(`defs.${key}.term`)}</dt>
            <dd>{t(`defs.${key}.text`)}</dd>
          </div>
        ))}
      </dl>
      <p>{t('note')}</p>
    </details>
  );
}
