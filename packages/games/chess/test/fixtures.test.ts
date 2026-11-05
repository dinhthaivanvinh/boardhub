import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayMatch } from '@bg/engine';
import { squareOf } from '../src/rules/board';
import { definition } from '../src/rules/definition';

interface Fixture {
  name: string;
  config: unknown;
  seed: string;
  /** Moves as "e2e4" (and "e7e8q" for promotions). */
  moves: string[];
  expected: { result: unknown };
}

const dir = join(import.meta.dirname, 'fixtures');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture);

describe('fixtures', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThan(0));

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, f) => {
    const recorded = f.moves.map((m, i) => ({
      seat: i % 2,
      move: {
        from: squareOf(m.slice(0, 2)),
        to: squareOf(m.slice(2, 4)),
        ...(m[4] ? { promotion: m[4].toUpperCase() } : {}),
      },
    }));
    const state = replayMatch(definition, f.config, 2, f.seed, recorded);
    expect(definition.result(state)).toEqual(f.expected.result);
  });
});
