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

// Every move of the piece on a few squares, promotions included, plus nonsense.
const candidates = [
  ...[52, 57, 59, 60, 12].flatMap((from) => Array.from({ length: 64 }, (_, to) => ({ from, to }))),
  ...['Q', 'N'].flatMap((promotion) =>
    Array.from({ length: 8 }, (_, c) => ({ from: 8 + c, to: c, promotion: promotion as 'Q' | 'N' })),
  ),
  { from: -1, to: 0 },
  { from: 0, to: 64 },
];

describe('chess invariants', () => {
  it('random games end with a valid result', () => {
    for (let g = 0; g < 8; g++) {
      randomPlayout(definition, config, `ch-${g}`, 3_000, {
        eachStep: (state, ply) => {
          if (ply % 40 !== 0) return;
          assertSerializable(state);
          assertLegalMovesConsistent(definition, state, candidates);
        },
      });
    }
  }, 120_000);

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, config, 3);
  }, 60_000);

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, config, 3);
  }, 60_000);
});
