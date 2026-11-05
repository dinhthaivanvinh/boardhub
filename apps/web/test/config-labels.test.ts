import { describe, expect, it } from 'vitest';
import { configFields as caroFields } from '@bg/game-caro';
import { describeConfig, type Tr } from '../src/features/rules/config-labels';
import { getMessagesFor } from '../src/i18n/messages';

/** A tiny translator over the real Vietnamese messages (dot paths, {placeholders}). */
function translator(): Tr {
  const messages = getMessagesFor('vi') as unknown as Record<string, unknown>;
  const lookup = (key: string) =>
    key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  const t = ((key: string, values?: Record<string, string | number>) => {
    const raw = lookup(key);
    if (typeof raw !== 'string') return key;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`));
  }) as Tr;
  t.has = (key) => typeof lookup(key) === 'string';
  return t;
}

describe('describeConfig', () => {
  it('lists the options of this game with readable values', () => {
    const rows = describeConfig(translator(), 'caro', caroFields, {
      size: 19,
      winLength: 5,
      blockedEndsRule: false,
      exactLength: true,
    });
    expect(rows).toEqual([
      { key: 'size', label: 'Kích thước bàn', value: '19 × 19' },
      { key: 'blockedEndsRule', label: 'Chặn hai đầu không tính thắng', value: 'Tắt' },
      { key: 'exactLength', label: 'Chỉ đúng 5 quân (6 quân trở lên không tính)', value: 'Bật' },
    ]);
  });

  it('falls back to the raw value when an option has no label', () => {
    const rows = describeConfig(translator(), 'caro', [{ key: 'size', kind: 'select', options: [21] }], {
      size: 21,
    });
    expect(rows[0]?.value).toBe('21');
  });

  it('games without options give no rows', () => {
    expect(describeConfig(translator(), 'xiangqi', [], {})).toEqual([]);
  });
});
