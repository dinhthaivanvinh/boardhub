// Tiny test-only game: players take 1-3 stones; whoever takes the last stone wins.
// The starting pile size is random, so it also exercises ctx.rng.
import { z } from 'zod';
import type { GameDefinition, Seat } from '../src';

export type NimState = { pile: number; turn: Seat; players: number; lastTaker: Seat | null };
export type NimMove = { take: number };
export type NimConfig = { minPile: number; maxPile: number };

export const nim: GameDefinition<NimState, NimMove, NimConfig> = {
  meta: {
    id: 'nim',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 3,
    tags: ['perfect-info', 'chance'],
    estimatedMinutes: 1,
    i18nKey: 'games.nim',
  },
  configSchema: z.strictObject({
    minPile: z.number().int().min(1).default(10),
    maxPile: z.number().int().min(1).default(20),
  }),
  moveSchema: z.strictObject({ take: z.number().int() }),
  setup: (config, players, { rng }) => ({
    pile: rng.int(config.minPile, config.maxPile + 1),
    turn: 0,
    players,
    lastTaker: null,
  }),
  activePlayers: (s) => (s.pile === 0 ? [] : [s.turn]),
  validateMove: (s, _seat, m) =>
    m.take >= 1 && m.take <= Math.min(3, s.pile) ? { ok: true } : { ok: false, code: 'nim.bad_take' },
  applyMove: (s, seat, m) => ({
    ...s,
    pile: s.pile - m.take,
    turn: (seat + 1) % s.players,
    lastTaker: seat,
  }),
  legalMoves: (s) => Array.from({ length: Math.min(3, s.pile) }, (_, i) => ({ take: i + 1 })),
  result: (s) =>
    s.pile === 0 && s.lastTaker !== null
      ? { kind: 'win', winners: [s.lastTaker], reason: 'last_stone' }
      : null,
  playerView: (s) => s,
};
