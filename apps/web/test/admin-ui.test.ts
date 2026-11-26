import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/features/admin/csv';
import { axisTicks, change, presetRange, validRange } from '../src/features/admin/range';

// 01:00 on 2026-11-26 in Vietnam, still the 25th in UTC.
const now = Date.UTC(2026, 10, 25, 18, 0);

describe('admin date ranges', () => {
  it('ends a preset today, in Vietnam time', () => {
    expect(presetRange('today', now)).toEqual({ from: '2026-11-26', to: '2026-11-26' });
    expect(presetRange('d7', now)).toEqual({ from: '2026-11-20', to: '2026-11-26' });
    expect(presetRange('d90', now)).toEqual({ from: '2026-08-29', to: '2026-11-26' });
    expect(validRange(presetRange('d90', now), now)).toBe(true);
  });

  it('refuses what the server would refuse', () => {
    expect(validRange({ from: '2026-11-26', to: '2026-11-20' }, now)).toBe(false);
    expect(validRange({ from: '2026-11-26', to: '2026-11-27' }, now)).toBe(false);
    expect(validRange({ from: '2026-01-01', to: '2026-11-26' }, now)).toBe(false);
    expect(validRange({ from: '', to: '2026-11-26' }, now)).toBe(false);
  });
});

describe('change against the range before', () => {
  it('says up, down, the same or unknown', () => {
    expect(change(12, 10)).toEqual({ kind: 'up', by: 2, percent: 20 });
    expect(change(5, 10)).toEqual({ kind: 'down', by: 5, percent: 50 });
    expect(change(3, 3)).toEqual({ kind: 'same' });
    expect(change(3, 0)).toEqual({ kind: 'up', by: 3, percent: null });
    expect(change(3, null)).toEqual({ kind: 'unknown' });
  });
});

describe('chart axis', () => {
  it('uses whole, round steps that reach the highest value', () => {
    expect(axisTicks(0)).toEqual([0, 1]);
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(130)).toEqual([0, 50, 100, 150]);
  });
});

describe('CSV export', () => {
  it('quotes what needs quoting and never lets a text cell become a formula', () => {
    expect(
      toCsv([
        ['Ngày', 'Ghi chú'],
        [12, 'a,"b"'],
        [-3, '=HYPERLINK("x")'],
      ]),
    ).toBe('﻿Ngày,Ghi chú\r\n12,"a,""b"""\r\n-3,"\'=HYPERLINK(""x"")"\r\n');
    expect(toCsv([['+1', '@x', '-y']])).toBe("﻿'+1,'@x,'-y\r\n");
  });
});
