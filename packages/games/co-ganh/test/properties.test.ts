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

// Every step between any two points, plus nonsense.
const candidates = [
  ...Array.from({ length: 25 * 25 }, (_, i) => ({ from: Math.floor(i / 25), to: i % 25 })),
  { from: -1, to: 0 },
  { from: 0, to: 25 },
];

describe('co-ganh invariants', () => {
  it('random playouts end with a valid result', () => {
    for (let g = 0; g < 30; g++) {
      randomPlayout(definition, config, `cg-${g}`, 2_000, {
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
