import { describe, it } from 'vitest';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoMutation,
  assertSerializable,
  randomPlayout,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';

const variants = [{}, { columns: 8, rows: 7 }, { columns: 9, rows: 7 }].map((raw) =>
  definition.configSchema.parse(raw),
);

describe('four-in-a-row invariants', () => {
  it.each(variants.map((c) => [JSON.stringify(c), c] as const))(
    'random playouts end with a valid result (%s)',
    (_name, config) => {
      const candidates = Array.from({ length: config.columns + 2 }, (_, i) => ({ col: i - 1 }));
      for (let g = 0; g < 100; g++) {
        randomPlayout(definition, config, `fiar-${g}`, config.columns * config.rows, {
          eachStep: (state) => {
            assertSerializable(state);
            assertLegalMovesConsistent(definition, state, candidates);
          },
        });
      }
    },
  );

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, variants[0]!, 30);
  });

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, variants[0]!, 30);
  });
});
