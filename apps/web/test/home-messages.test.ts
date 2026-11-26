import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import vi from '../src/i18n/vi.json';

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const flat = (obj: unknown, prefix = ''): string[] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const page = readFileSync(join(__dirname, '../src/app/page.tsx'), 'utf8');
const stepsSource = readFileSync(join(__dirname, '../src/features/learn/adventure-steps.ts'), 'utf8');

describe('home page messages', () => {
  for (const [name, messages] of [
    ['vi', vi],
    ['en', en],
  ] as const) {
    it(`${name}: every text the home page asks for exists`, () => {
      // t('benefits.title'), t('play.title'): the plain keys of the portal namespace.
      const plain = [...page.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]!);
      expect(plain.length).toBeGreaterThan(5);
      for (const key of plain) expect(get(messages.portal, key), `portal.${key}`).toBeTypeOf('string');

      // The adventure map: a place name, a text and a lesson title for each of the eight places.
      const steps = [...stepsSource.matchAll(/key: '(\w+)'/g)].map((m) => m[1]!);
      expect(steps.length).toBe(8);
      for (const step of steps) {
        for (const key of [`map.${step}.place`, `map.${step}.text`, `path.${step}.title`]) {
          expect(get(messages.portal, key), `portal.${key}`).toBeTypeOf('string');
        }
      }
    });
  }

  it('the navigation and home texts are the same in vi and en', () => {
    for (const ns of ['nav', 'portal', 'admin'] as const) {
      expect(flat(en[ns]).sort(), ns).toEqual(flat(vi[ns]).sort());
    }
  });
});
