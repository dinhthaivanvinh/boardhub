import { z } from 'zod';
import type { AnyGameDefinition, GameDefinition, Seat } from '@bg/engine';
import type { ChatMessage, MatchSnapshot, RoomSnapshot, TimeControl } from '@bg/protocol';
import { InlineBotRunner } from '../src/bots/bot-runner';
import type { Actor } from '../src/domain/types';
import { GameHub, type Notifier } from '../src/hub/game-hub';
import { ManualScheduler } from '../src/hub/scheduler';
import { GAME_DEFS } from '../src/registry';
import { MemoryLiveStore } from '../src/store/live-store';
import { MemoryHistoryRepo } from '../src/store/repos';

export const alice: Actor = { userId: 'u-alice', name: 'Alice' };
export const bob: Actor = { userId: 'u-bob', name: 'Bob' };
export const carol: Actor = { userId: 'u-carol', name: 'Carol' };

export const silentLog = { info() {}, warn() {}, error() {} };

/**
 * Test-only hidden-information game: each seat gets a secret number; players take turns guessing
 * the other's secret. Used to prove the hub never sends another player's secret.
 */
type SecretState = { secrets: number[]; turn: Seat; guessed: Seat | null };
export const secretGame: GameDefinition<SecretState, { guess: number }, Record<string, never>> = {
  meta: {
    id: 'secret',
    rulesVersion: 1,
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['hidden-info'],
    estimatedMinutes: 1,
    i18nKey: 'games.secret',
  },
  configSchema: z.strictObject({}),
  moveSchema: z.strictObject({ guess: z.number().int() }),
  setup: (_c, _n, { rng }) => ({ secrets: [rng.int(0, 1000), rng.int(0, 1000)], turn: 0, guessed: null }),
  activePlayers: (s) => (s.guessed === null ? [s.turn] : []),
  validateMove: () => ({ ok: true }),
  applyMove: (s, seat, m) => ({
    ...s,
    guessed: m.guess === s.secrets[1 - seat] ? seat : null,
    turn: seat === 0 ? 1 : 0,
  }),
  legalMoves: () => [{ guess: 0 }],
  result: (s) => (s.guessed === null ? null : { kind: 'win', winners: [s.guessed], reason: 'guessed' }),
  playerView: (s, viewer) => ({
    mySecret: viewer === 'spectator' ? null : s.secrets[viewer],
    turn: s.turn,
  }),
};

export function makeHub(opts: { graceMs?: number; botDelayMs?: number } = {}) {
  let now = 1_000_000;
  const store = new MemoryLiveStore();
  const history = new MemoryHistoryRepo();
  const scheduler = new ManualScheduler();
  const events = {
    rooms: [] as RoomSnapshot[],
    matches: [] as Parameters<Notifier['matchUpdated']>[0][],
    chats: [] as ChatMessage[],
  };
  const notifier: Notifier = {
    roomUpdated: (r) => events.rooms.push(r),
    matchUpdated: (m) => events.matches.push(m),
    chatMessage: (c) => events.chats.push(c),
  };
  let ids = 0;
  let codes = 0;
  const games: Record<string, AnyGameDefinition> = { ...GAME_DEFS, secret: secretGame };
  const hub = new GameHub({
    store,
    history,
    games,
    bots: new InlineBotRunner(),
    scheduler,
    notifier,
    log: silentLog,
    now: () => now,
    newId: () => `id-${++ids}`,
    newSeed: () => 'seed',
    newCode: () => `CODE${String(++codes).padStart(2, '0')}`,
    graceMs: opts.graceMs ?? 60_000,
    botDelayMs: opts.botDelayMs ?? 400,
  });
  return {
    hub,
    store,
    history,
    scheduler,
    events,
    now: () => now,
    /** Moves time forward and runs every timer that became due. */
    advance: async (ms: number) => {
      now += ms;
      await scheduler.advanceTo(now);
    },
    /** Moves time forward without running timers (as if the timer was late). */
    skip: (ms: number) => {
      now += ms;
    },
  };
}

export type TestHub = ReturnType<typeof makeHub>;

/** Alice hosts at seat 0, Bob joins seat 1 and is ready, the match starts. */
export async function startTwoPlayer(
  t: TestHub,
  gameId = 'caro',
  extra: { timeControl?: TimeControl; disconnectPolicy?: 'forfeit' | 'bot' } = {},
) {
  const room = await t.hub.createRoom(alice, {
    gameId,
    timeControl: extra.timeControl ?? { type: 'none' },
    disconnectPolicy: extra.disconnectPolicy ?? 'forfeit',
    hostSeat: 0,
  });
  await t.hub.joinRoom(bob, room.code);
  await t.hub.takeSeat(bob, room.id, 1);
  await t.hub.setReady(bob, room.id, true);
  await t.hub.startMatch(alice, room.id);
  const stored = (await t.store.getRoom(room.id))!;
  return { roomId: room.id, code: room.code, matchId: stored.matchId! };
}

let moveIds = 0;
export const moveId = () => `move-${String(++moveIds).padStart(6, '0')}`;

export async function play(t: TestHub, actor: Actor, matchId: string, move: unknown) {
  const match = (await t.store.getMatch(matchId))!;
  return t.hub.submitMove(actor, { matchId, seq: match.seq, clientMoveId: moveId(), move });
}

export const lastSnapshotFor = (t: TestHub, userId: string): MatchSnapshot | undefined =>
  t.events.matches.at(-1)?.perUser.find((p) => p.userId === userId)?.snapshot;
