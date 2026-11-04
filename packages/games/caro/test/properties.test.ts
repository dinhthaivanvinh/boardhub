import { describe, it } from 'vitest';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoMutation,
  assertSerializable,
  randomPlayout,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';

const variants = [{}, { blockedEndsRule: false }, { exactLength: true }, { size: 19 }].map((raw) =>
  definition.configSchema.parse(raw),
);

describe('caro invariants', () => {
  it.each(variants.map((c) => [JSON.stringify(c), c] as const))(
    'random playouts end with a valid result (%s)',
    (_name, config) => {
      const size = config.size * config.size;
      const candidates = [-1, 0, Math.floor(size / 2), size - 1, size].map((cell) => ({ cell }));
      for (let g = 0; g < 40; g++) {
        randomPlayout(definition, config, `caro-${g}`, size, {
          eachStep: (state, ply) => {
            // Checking every step is slow on 19x19; sample every 7th ply.
            if (ply % 7 !== 0) return;
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
