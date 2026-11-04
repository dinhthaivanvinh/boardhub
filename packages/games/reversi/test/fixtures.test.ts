import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayMatch } from '@bg/engine';
import { countDiscs } from '../src/rules/board';
import { definition } from '../src/rules/definition';

interface Fixture {
  name: string;
  config: unknown;
  seed: string;
  moves: { cell: number }[];
  expected: { result: unknown; discs?: [number, number]; black?: number[]; white?: number[] };
}

const dir = join(import.meta.dirname, 'fixtures');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture);

describe('fixtures', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThan(0));

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, f) => {
    // Passes mean the same seat can move twice, so seats come from the replayed state, not from move parity.
    let state = definition.setup(definition.configSchema.parse(f.config), 2, { rng: undefined as never });
    const recorded = f.moves.map((move) => {
      const seat = definition.activePlayers(state)[0]!;
      state = definition.applyMove(state, seat, move, { rng: undefined as never });
      return { seat, move };
    });
    const replayed = replayMatch(definition, f.config, 2, f.seed, recorded);
    expect(definition.result(replayed)).toEqual(f.expected.result);
    if (f.expected.discs) expect(countDiscs(replayed.board)).toEqual(f.expected.discs);
    const cellsOf = (piece: 0 | 1) => replayed.board.flatMap((v, i) => (v === piece ? [i] : []));
    if (f.expected.black) expect(cellsOf(0)).toEqual(f.expected.black);
    if (f.expected.white) expect(cellsOf(1)).toEqual(f.expected.white);
  });
});
