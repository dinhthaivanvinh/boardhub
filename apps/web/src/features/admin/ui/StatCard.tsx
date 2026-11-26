'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { Compared } from '@bg/protocol';
import { change } from '../range';
import { AdminIcon, type IconName } from './icons';

/** How the number of a range moved against the range of the same length before it. */
export function Delta({ label, compared }: { label?: string; compared: Compared }) {
  const t = useTranslations('admin.delta');
  const format = useFormatter();
  const c = change(compared.value, compared.previous);
  if (c.kind === 'unknown') return <p className="admin-delta">{t('unknown')}</p>;
  const before = format.number(compared.previous!);
  if (c.kind === 'same') return <p className="admin-delta">{t('same', { before })}</p>;
  // From zero there is no percentage: the plain difference is shown.
  const amount =
    c.percent === null ? format.number(c.by) : format.number(c.percent / 100, { style: 'percent' });
  return (
    <p className="admin-delta" data-direction={c.kind}>
      <span aria-hidden="true">{c.kind === 'up' ? '▲' : '▼'}</span> <strong>{t(c.kind, { amount })}</strong>{' '}
      {t('against', { before })}
      {label ? ` ${label}` : ''}
    </p>
  );
}

/** Covers a card: the card stays plain markup and the whole of it can be pressed. */
export function OpenButton({ label, run }: { label: string; run(): void }) {
  return (
    <button
      type="button"
      className="admin-stat-open"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={run}
    />
  );
}

export function StatCard({
  icon,
  label,
  value,
  note,
  compared,
  testId,
  open,
}: {
  icon: IconName;
  label: string;
  /** null: the number cannot be known (nothing was recorded for it yet). */
  value: number | null;
  note?: string;
  compared?: Compared;
  testId?: string;
  /** Makes the whole card a way to see what is behind the number; `label` names the button. */
  open?: { label: string; run(): void };
}) {
  const format = useFormatter();
  return (
    <div className="card admin-stat" data-testid={testId}>
      <div className="admin-stat-head">
        <span className="admin-stat-icon">
          <AdminIcon name={icon} />
        </span>
        <span>{label}</span>
      </div>
      <div className="admin-stat-value">{value === null ? '—' : format.number(value)}</div>
      {note && <p className="admin-stat-note">{note}</p>}
      {compared && value !== null && <Delta compared={compared} />}
      {open && <OpenButton {...open} />}
    </div>
  );
}
