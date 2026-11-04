import { describe, it } from 'vitest';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoMutation,
  assertSerializable,
  randomPlayout,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';

const variants = [{}, { size: 6 }, { size: 10 }].map((raw) => definition.configSchema.parse(raw));

describe('reversi invariants', () => {
  it.each(variants.map((c) => [JSON.stringify(c), c] as const))(
    'random playouts end with a valid result (%s)',
    (_name, config) => {
      const cells = config.size * config.size;
      const candidates = Array.from({ length: cells + 2 }, (_, i) => ({ cell: i - 1 }));
      for (let g = 0; g < 40; g++) {
        randomPlayout(definition, config, `rv-${g}`, cells, {
          eachStep: (state, ply) => {
            if (ply % 3 !== 0) return;
            assertSerializable(state);
            assertLegalMovesConsistent(definition, state, candidates);
          },
        });
      }
    },
  );

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, variants[0]!, 20);
  });

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, variants[0]!, 20);
  });
});
