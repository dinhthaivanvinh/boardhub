import { addDays, DateRangeQuery, vnDay, type DateRange } from '@bg/protocol';

export const PRESET_DAYS = { today: 1, d7: 7, d14: 14, d30: 30, d90: 90 } as const;
export type Preset = keyof typeof PRESET_DAYS;
export const PRESETS = Object.keys(PRESET_DAYS) as Preset[];

/** The range of a preset: that many days ending today (Vietnam time). */
export function presetRange(preset: Preset, now: number = Date.now()): DateRange {
  const to = vnDay(now);
  return { from: addDays(to, 1 - PRESET_DAYS[preset]), to };
}

/** True when the server will accept this range: real days, in order, at most 90 of them, none in the future. */
export const validRange = (range: DateRange, now: number = Date.now()): boolean =>
  DateRangeQuery.safeParse(range).success && range.to <= vnDay(now);

export type Change =
  | { kind: 'unknown' }
  | { kind: 'same' }
  /** `percent` is null when the earlier number is zero: there is nothing to take a share of. */
  | { kind: 'up' | 'down'; by: number; percent: number | null };

/** How a number moved against the range before. */
export function change(current: number, previous: number | null): Change {
  if (previous === null) return { kind: 'unknown' };
  const by = current - previous;
  if (by === 0) return { kind: 'same' };
  return {
    kind: by > 0 ? 'up' : 'down',
    by: Math.abs(by),
    percent: previous === 0 ? null : Math.round((Math.abs(by) / previous) * 100),
  };
}

/** Whole-number axis ticks from 0 to at least `max`, in steps of 1, 2 or 5 times a power of ten. */
export function axisTicks(max: number, wanted = 4): number[] {
  const raw = Math.max(max, 1) / wanted;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!,
  );
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
