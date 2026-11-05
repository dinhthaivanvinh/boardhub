import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayMatch } from '@bg/engine';
import { definition } from '../src/rules/definition';

interface Fixture {
  name: string;
  config: unknown;
  seed: string;
  /** Seats are recorded: a hit gives the same seat another shot. */
  moves: { seat: number; move: unknown }[];
  expected: { result: unknown; turn?: number; sunk?: number[][]; lastShot?: unknown };
}

const dir = join(import.meta.dirname, 'fixtures');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture);

describe('fixtures', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThan(0));

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, f) => {
    const state = replayMatch(definition, f.config, 2, f.seed, f.moves as never);
    expect(definition.result(state)).toEqual(f.expected.result);
    if (f.expected.turn !== undefined) expect(state.turn).toBe(f.expected.turn);
    if (f.expected.sunk) expect(state.sunk).toEqual(f.expected.sunk);
    if (f.expected.lastShot) expect(state.lastShot).toEqual(f.expected.lastShot);
  });
});
