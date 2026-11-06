'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { settingsSchema, type LiXiSettings } from '@bg/office-li-xi';
import { formatVnd, previewOf } from './money';

/** Common notes, offered first when adding a row. */
export const PRESETS = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000] as const;

type Row = LiXiSettings['denominations'][number];

/** Why the settings are not valid yet, as an i18n key under liXiNew.errors (null = fine). */
export function settingsError(settings: LiXiSettings): string | null {
  const ds = settings.denominations;
  if (ds.length === 0) return 'empty';
  if (new Set(ds.map((d) => d.value)).size !== ds.length) return 'duplicate';
  if (ds.filter((d) => d.count === null).length > 1) return 'unlimited';
  return settingsSchema.safeParse(settings).success ? null : 'range';
}

/** The host's notes: value, how many (or unlimited), who is called next, and whether the host receives. */
export function LiXiSettingsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: LiXiSettings;
  onChange: (next: LiXiSettings) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('liXiNew');
  const locale = useLocale();
  const listId = useId();
  const rows = value.denominations;
  const setRows = (denominations: Row[]) => onChange({ ...value, denominations });
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const nextPreset = PRESETS.find((p) => !rows.some((r) => r.value === p));
  const error = settingsError(value);

  return (
    <fieldset className="flex flex-col gap-4" disabled={disabled}>
      <div>
        <legend className="font-medium">{t('denominations')}</legend>
        <p className="text-sm text-[var(--muted)]">{t('denominationsHint')}</p>
      </div>
      <datalist id={listId}>
        {PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <ul className="flex flex-col gap-2" data-testid="li-xi-rows">
        {rows.map((r, i) => (
          <li key={i} className="lixi-row" data-testid="li-xi-row">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              {t('value')}
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                max={10_000_000}
                step={1000}
                list={listId}
                value={r.value}
                onChange={(e) => setRow(i, { value: Math.round(Number(e.target.value) || 0) })}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono"
              />
              <span className="text-xs text-[var(--muted)]">{formatVnd(locale, r.value)}</span>
            </label>
            <label className="flex w-28 flex-col gap-1 text-sm">
              {t('count')}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={r.count ?? ''}
                placeholder="∞"
                disabled={r.count === null}
                onChange={(e) => setRow(i, { count: Math.round(Number(e.target.value) || 0) })}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono disabled:opacity-50"
              />
            </label>
            <label className="flex items-center gap-2 self-center text-sm">
              <input
                type="checkbox"
                checked={r.count === null}
                onChange={(e) => setRow(i, { count: e.target.checked ? null : 1 })}
              />
              {t('unlimited')}
            </label>
            <button
              type="button"
              className="btn self-center px-2"
              aria-label={t('removeRow', { value: formatVnd(locale, r.value) })}
              disabled={rows.length <= 1}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {rows.length < 8 && (
        <button
          type="button"
          className="btn self-start"
          onClick={() => setRows([...rows, { value: nextPreset ?? 1_000, count: 1 }])}
        >
          + {t('addRow')}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-medium">{t('order')}</span>
        {(['random', 'joined'] as const).map((o) => (
          <label key={o} className="flex items-center gap-2">
            <input
              type="radio"
              name="li-xi-order"
              checked={value.order === o}
              onChange={() => onChange({ ...value, order: o })}
            />
            {t(o === 'random' ? 'orderRandom' : 'orderJoined')}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.hostReceives}
          onChange={(e) => onChange({ ...value, hostReceives: e.target.checked })}
        />
        {t('hostReceives')}
      </label>
    </fieldset>
  );
}

/** "With N people: 3 × 500.000 ₫, … Total: …", following the same pile rule as the server. */
export function LiXiPreview({ settings, people }: { settings: LiXiSettings; people: number }) {
  const t = useTranslations('liXiNew');
  const locale = useLocale();
  if (settingsError(settings) || people <= 0) return null;
  const p = previewOf(settings, people);
  const money = (v: number) => formatVnd(locale, v);
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="li-xi-preview">
      {p.exact ? (
        <>
          <ul>
            {p.rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <li key={r.value}>{t('previewRow', { count: r.count, value: money(r.value) })}</li>
              ))}
            {p.wishes > 0 && <li>{t('previewWishes', { count: p.wishes })}</li>}
          </ul>
          <p className="font-semibold" data-testid="li-xi-preview-total">
            {t('previewTotal', { total: money(p.max) })}
          </p>
        </>
      ) : (
        <>
          <p>{t('previewRandom', { n: people, limited: p.limited })}</p>
          <p className="font-semibold" data-testid="li-xi-preview-total">
            {t('previewRange', { min: money(p.min), max: money(p.max) })}
          </p>
        </>
      )}
    </div>
  );
}
