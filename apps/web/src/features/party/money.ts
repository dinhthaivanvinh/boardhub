import { envelopePool, valueOf, type LiXiSettings } from '@bg/office-li-xi';

/** 500000 → "500.000 ₫" (vi) or "₫500,000" (en). */
export function formatVnd(locale: string, value: number): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

/** 500000 → "500K", 2000000 → "2M": for the short label on a note. */
export function shortVnd(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  return `${Math.round(value / 1_000)}K`;
}

export interface Preview {
  /** How many people get each row's value (exact only when `exact`). */
  rows: { value: number; count: number }[];
  wishes: number;
  /** Limited notes in the pile. */
  limited: number;
  /** With fewer people than limited notes, who gets what is drawn: totals are a range. */
  exact: boolean;
  min: number;
  max: number;
}

/** What happens with `people` receivers, following the activity's pile rule. */
export function previewOf(settings: LiXiSettings, people: number): Preview {
  const pool = envelopePool({ settings, started: false, gifts: [] }, people);
  const values = pool.map((e) => valueOf(settings, e));
  const limited = settings.denominations.reduce((n, d) => n + (d.count ?? 0), 0);
  const exact = people >= limited;
  const sorted = [...values].sort((a, b) => b - a);
  const take = Math.min(people, sorted.length);
  const max = sorted.slice(0, take).reduce((a, b) => a + b, 0);
  const min = sorted.slice(sorted.length - take).reduce((a, b) => a + b, 0);
  const count = (v: number) => values.filter((x) => x === v).length;
  const rows = settings.denominations.map((d) => ({ value: d.value, count: exact ? count(d.value) : 0 }));
  return {
    rows,
    wishes: values.filter((v) => v === 0).length,
    limited,
    exact,
    min,
    max,
  };
}
