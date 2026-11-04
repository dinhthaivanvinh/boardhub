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

// A handful of candidates outside the legal list: same piece to every point, and a few nonsense moves.
const candidates = [
  ...Array.from({ length: 90 }, (_, to) => ({ from: 81, to })), // red chariot's start point
  { from: -1, to: 0 },
  { from: 0, to: 90 },
  { from: 40, to: 41 },
];

describe('xiangqi invariants', () => {
  it('random playouts end with a valid result', () => {
    for (let g = 0; g < 15; g++) {
      randomPlayout(definition, config, `xq-${g}`, 5_000, {
        eachStep: (state, ply) => {
          if (ply % 25 !== 0) return;
          assertSerializable(state);
          assertLegalMovesConsistent(definition, state, candidates);
        },
      });
    }
  }, 60_000);

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, config, 4);
  }, 60_000);

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, config, 4);
  }, 60_000);
});
