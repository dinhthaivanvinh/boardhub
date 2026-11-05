import { describe, expect, it } from 'vitest';
import {
  assertDeterministic,
  assertLegalMovesConsistent,
  assertNoHiddenLeak,
  assertNoMutation,
  assertSerializable,
  randomPlayout,
} from '@bg/engine/testing';
import { definition } from '../src/rules/definition';
import { STOCK_LAYOUTS } from '../src/rules/fleet';
import type { BanTauMove, BanTauState } from '../src/rules/types';
import { resampleHidden } from './helpers';

const config = definition.configSchema.parse({});

const candidates: BanTauMove[] = [
  ...Array.from({ length: 100 }, (_, cell) => ({ kind: 'fire' as const, cell })),
  { kind: 'fire', cell: -1 },
  { kind: 'fire', cell: 100 },
  { kind: 'place', ships: STOCK_LAYOUTS[0]! },
  { kind: 'place', ships: STOCK_LAYOUTS[0]!.slice(1) },
];

describe('ban-tau invariants', () => {
  it('random playouts end with a winner, and nothing hidden ever leaks', () => {
    for (let g = 0; g < 12; g++) {
      const states: BanTauState[] = [];
      const end = randomPlayout(definition, config, `bt-${g}`, 1_000, {
        eachStep: (state, ply) => {
          if (ply % 15 !== 0) return;
          assertSerializable(state);
          assertLegalMovesConsistent(definition, state, candidates);
          states.push(state);
        },
      });
      expect(end.result.kind).toBe('win');
      for (const s of states) {
        assertNoHiddenLeak(definition, s, resampleHidden, { players: 2, samples: 6, seed: `leak-${g}` });
      }
    }
  }, 60_000);

  it('is deterministic and replays to the same state', () => {
    assertDeterministic(definition, config, 4);
  }, 60_000);

  it('applyMove never mutates its input', () => {
    assertNoMutation(definition, config, 4);
  }, 60_000);
});
