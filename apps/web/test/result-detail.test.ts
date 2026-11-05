import { describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { resultDetail } from '../src/features/match/result-detail';

/** A tiny translator over the real Vietnamese messages. */
const t = Object.assign(
  (key: string, values: Record<string, string | number> = {}) => {
    const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], vi);
    if (typeof text !== 'string') throw new Error(`missing ${key}`);
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k]));
  },
  { has: () => true },
);
const opts = { loserName: 'Người chơi 2', reasonText: (r: string) => `lý do ${r}` };

describe('resultDetail', () => {
  it('resigning reads right for each side', () => {
    expect(resultDetail(t, 'loss', 'resign', opts)).toBe('Bạn đã đầu hàng');
    expect(resultDetail(t, 'win', 'resign', opts)).toBe('Đối thủ đầu hàng');
    expect(resultDetail(t, 'neutral', 'resign', opts)).toBe('Người chơi 2 đầu hàng');
  });

  it('leaving and running out of time too', () => {
    expect(resultDetail(t, 'loss', 'abandon', opts)).toBe('Bạn đã rời trận');
    expect(resultDetail(t, 'win', 'abandon', opts)).toBe('Đối thủ rời trận');
    expect(resultDetail(t, 'loss', 'timeout', opts)).toBe('Bạn hết giờ');
    expect(resultDetail(t, 'win', 'timeout', opts)).toBe('Đối thủ hết giờ');
    expect(resultDetail(t, 'neutral', 'timeout', opts)).toBe('Người chơi 2 hết giờ');
  });

  it('other reasons are the game reason, capitalised', () => {
    expect(resultDetail(t, 'loss', 'five_in_row', opts)).toBe('Lý do five_in_row');
    expect(resultDetail(t, 'draw', 'agreement', opts)).toBe('Lý do agreement');
  });
});
