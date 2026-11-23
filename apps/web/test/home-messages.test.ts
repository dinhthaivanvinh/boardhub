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

describe('home page messages', () => {
  for (const [name, messages] of [
    ['vi', vi],
    ['en', en],
  ] as const) {
    it(`${name}: every text the home page asks for exists`, () => {
      // t('what.title'), t('more.badge', {...}): the plain keys of the portal namespace.
      const plain = [...page.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]!);
      expect(plain.length).toBeGreaterThan(5);
      for (const key of plain) expect(get(messages.portal, key), `portal.${key}`).toBeTypeOf('string');

      // The lesson path: one title, text and call to action per step, listed in STEPS.
      const steps = [
        ...(/const STEPS = \[([\s\S]*?)\] as const/.exec(page)?.[1] ?? '').matchAll(/key: '(\w+)'/g),
      ].map((m) => m[1]!);
      expect(steps.length).toBeGreaterThanOrEqual(4);
      for (const step of steps) {
        for (const part of ['title', 'text', 'cta']) {
          expect(get(messages.portal, `path.${step}.${part}`), `portal.path.${step}.${part}`).toBeTypeOf(
            'string',
          );
        }
      }
    });
  }

  it('the navigation and home texts are the same in vi and en', () => {
    for (const ns of ['nav', 'portal'] as const) {
      expect(flat(en[ns]).sort(), ns).toEqual(flat(vi[ns]).sort());
    }
  });
});
