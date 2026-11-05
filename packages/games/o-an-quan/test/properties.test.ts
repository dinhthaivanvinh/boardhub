import { describe, it } from 'vitest';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoMutation,
  assertSerializable,
  randomPlayout,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';

const config = definition.configSchema.parse({});

// Every square in both directions, plus nonsense.
const candidates = [
  ...Array.from({ length: 12 }, (_, cell) => [
    { cell, dir: 1 as const },
    { cell, dir: -1 as const },
  ]).flat(),
  { cell: -1, dir: 1 as const },
  { cell: 12, dir: -1 as const },
];

describe('o-an-quan invariants', () => {
  it('random playouts end with a valid result', () => {
    for (let g = 0; g < 30; g++) {
      randomPlayout(definition, config, `oaq-${g}`, 2_000, {
        eachStep: (state, ply) => {
          if (ply % 10 !== 0) return;
          assertSerializable(state);
          assertLegalMovesConsistent(definition, state, candidates);
        },
      });
    }
  }, 60_000);

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, config, 6);
  }, 60_000);

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, config, 6);
  }, 60_000);
});
