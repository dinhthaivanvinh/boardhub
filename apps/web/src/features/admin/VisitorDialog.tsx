'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DateRange, VisitorKind, VisitorList } from '@bg/protocol';
import { adminVisitors } from '@/online/admin-api';
import { ErrorLine, Loading, useLoad } from './ui/common';

export type VisitorFilter = 'total' | VisitorKind;
const FILTERS: VisitorFilter[] = ['total', 'registered', 'guest', 'anonymous'];

export interface VisitorQuestion {
  range: DateRange;
  filter: VisitorFilter;
}

/** Who is behind a visitor number: the accounts by name. A visitor who is not signed in has no name. */
export function VisitorDialog({ question, onClose }: { question: VisitorQuestion; onClose(): void }) {
  const t = useTranslations('admin.stats.who');
  const format = useFormatter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState(question.filter);
  const load = useCallback(() => adminVisitors(question.range), [question]);
  const { data, error, reload } = useLoad(load);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const day = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00+07:00`), { dateStyle: 'medium' });
  const { from, to } = question.range;

  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      // a click on the backdrop closes it, like Esc
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      data-testid="visitor-dialog"
    >
      <div className="admin-dialog-body">
        <header className="admin-panel-head">
          <div>
            <h2 id={titleId}>{t('title')}</h2>
            <p>{from === to ? day(from) : t('range', { from: day(from), to: day(to) })}</p>
          </div>
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            {t('close')}
          </button>
        </header>
        <div className="admin-segment" role="group" aria-label={t('filter')}>
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              data-testid={`who-${id}`}
            >
              {t(`filters.${id}`)}
            </button>
          ))}
        </div>
        <ErrorLine code={error} onRetry={() => void reload()} />
        {!data ? !error && <Loading /> : <List data={data} filter={filter} day={day} />}
      </div>
    </dialog>
  );
}

function List({
  data,
  filter,
  day,
}: {
  data: VisitorList;
  filter: VisitorFilter;
  day(value: string): string;
}) {
  const t = useTranslations('admin.stats.who');
  const accounts = data.accounts.filter((a) => filter === 'total' || a.kind === filter);
  const withAnonymous = filter === 'total' || filter === 'anonymous';
  // Accounts were not recorded for the first days of this range (or at all).
  const missing = data.since === null || data.range.from < data.since;

  return (
    <>
      {missing && (
        <p className="admin-note-box">
          {data.since === null ? t('sinceNever') : t('since', { day: day(data.since) })}
        </p>
      )}
      {withAnonymous && (
        <p className="admin-note-box" data-testid="who-unnamed">
          {t('unnamed', { count: data.browsers.anonymous })}
        </p>
      )}
      {filter !== 'anonymous' &&
        (accounts.length === 0 ? (
          <p className="admin-empty">{t('empty')}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table" data-testid="who-table">
              <thead>
                <tr>
                  <th scope="col">{t('name')}</th>
                  <th scope="col">{t('email')}</th>
                  <th scope="col">{t('kind')}</th>
                  <th scope="col" className="num">
                    {t('days')}
                  </th>
                  <th scope="col">{t('lastDay')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.name}</th>
                    <td>{a.email ?? '—'}</td>
                    <td>{t(`filters.${a.kind}`)}</td>
                    <td className="num">{a.days}</td>
                    <td>{day(a.lastDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {data.truncated && <p className="admin-muted">{t('truncated', { count: data.accounts.length })}</p>}
      {filter !== 'anonymous' && <p className="admin-muted">{t('counting')}</p>}
    </>
  );
}
