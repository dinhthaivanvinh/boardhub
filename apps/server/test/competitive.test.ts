import { describe, expect, it, vi } from 'vitest';
import { HubError } from '../src/errors';
import { Matchmaker, ratingWindow } from '../src/matchmaking/matchmaker';
import { GAME_DEFS } from '../src/registry';
import { alice, bob, carol, lastSnapshotFor, makeHub, play, silentLog, type TestHub } from './helpers';

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof HubError ? e.code : `unexpected: ${String(e)}`),
  );

const blitz = { type: 'fischer', baseMs: 180_000, incrementMs: 2_000 } as const;

async function matched(t: TestHub, ranked: boolean) {
  const room = await t.hub.createMatchedRoom(
    [
      { actor: alice, rating: 1500 },
      { actor: bob, rating: 1500 },
    ],
    { gameId: 'four-in-a-row', timeControl: blitz, ranked },
  );
  return { room, matchId: (await t.store.getRoom(room.id))!.matchId! };
}

/** Alice (seat 0) stacks four in column 0 and wins. */
async function aliceWins(t: TestHub, matchId: string) {
  for (const [who, col] of [
    [alice, 0],
    [bob, 1],
    [alice, 0],
    [bob, 1],
    [alice, 0],
    [bob, 1],
    [alice, 0],
  ] as const) {
    await play(t, who, matchId, { col });
  }
}

describe('matched rooms', () => {
  it('start right away with both players seated, ready, rated, and listed as live', async () => {
    const t = makeHub();
    const { room, matchId } = await matched(t, true);
    expect(room).toMatchObject({ status: 'playing', ranked: true, public: true });
    expect(room.seats).toMatchObject([
      { userId: alice.userId, ready: true, rating: 1500 },
      { userId: bob.userId, ready: true, rating: 1500 },
    ]);
    expect(await t.store.liveRoomIds()).toEqual([room.id]);
    expect(lastSnapshotFor(t, bob.userId)).toMatchObject({ matchId, mySeat: 1, ratingChanges: null });
    expect(t.history.matches.get(matchId)).toMatchObject({ ranked: true });
  });

  it('a ranked result updates both ratings once and shows the change', async () => {
    const t = makeHub();
    const { room, matchId } = await matched(t, true);
    await aliceWins(t, matchId);

    const changes = lastSnapshotFor(t, alice.userId)?.ratingChanges;
    expect(changes).toHaveLength(2);
    const [a, b] = changes!;
    expect(a).toMatchObject({ seat: 0, before: 1500 });
    expect(a!.after).toBeGreaterThan(1600);
    expect(b!.after).toBeLessThan(1400);
    expect(await t.ratings.repo.get(alice.userId, 'four-in-a-row')).toMatchObject({ games: 1, wins: 1 });
    expect(await t.ratings.repo.get(bob.userId, 'four-in-a-row')).toMatchObject({ games: 1, losses: 1 });
    expect(t.history.matches.get(matchId)?.ratingChanges).toEqual(changes);
    // The room shows the new ratings, and the game is no longer live.
    expect(t.events.rooms.at(-1)?.seats[0]).toMatchObject({ rating: a!.after });
    expect(await t.store.liveRoomIds()).toEqual([]);
    expect(room.id).toBeTruthy();
  });

  it('draws and resignations count too', async () => {
    const t = makeHub();
    const { matchId } = await matched(t, true);
    await t.hub.matchAction(alice, matchId, 'offer-draw');
    await t.hub.matchAction(bob, matchId, 'accept-draw');
    expect(await t.ratings.repo.get(alice.userId, 'four-in-a-row')).toMatchObject({ games: 1, draws: 1 });
  });

  it('casual matched rooms never change ratings', async () => {
    const t = makeHub();
    const { matchId } = await matched(t, false);
    await aliceWins(t, matchId);
    expect(lastSnapshotFor(t, alice.userId)?.ratingChanges).toBeNull();
    expect(await t.ratings.repo.get(alice.userId, 'four-in-a-row')).toMatchObject({ games: 0, rating: 1500 });
  });

  it('private rooms are neither ranked nor listed; bots cannot join ranked rooms', async () => {
    const t = makeHub();
    const priv = await t.hub.createRoom(carol, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    expect(priv).toMatchObject({ ranked: false, public: false });
    const { room, matchId } = await matched(t, true);
    await t.hub.matchAction(bob, matchId, 'resign');
    await t.hub.rematch(alice, room.id);
    expect(await code(t.hub.addBot(alice, room.id, 1, 'easy'))).toBe('room.invalid_state');
  });
});

describe('Matchmaker', () => {
  function setup() {
    let now = 1_000_000;
    const t = makeHub();
    const notify = vi.fn();
    const mm = new Matchmaker({
      store: t.store,
      hub: t.hub,
      games: GAME_DEFS,
      ratings: t.ratings,
      notify,
      log: silentLog,
      now: () => now,
      coinFlip: () => true,
    });
    return { t, mm, notify, tick: (ms: number) => (now += ms) };
  }

  const setRating = (t: TestHub, userId: string, rating: number) =>
    t.ratings.repo.save({
      userId,
      gameId: 'caro',
      rating,
      rd: 80,
      volatility: 0.06,
      games: 10,
      wins: 5,
      losses: 5,
      draws: 0,
    });

  it('pairs two players waiting for the same game and starts the match', async () => {
    const { t, mm, notify } = setup();
    await mm.join(alice, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    expect(notify).not.toHaveBeenCalled();
    await mm.join(bob, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    expect(notify).toHaveBeenCalledTimes(2);
    const roomCode = notify.mock.calls[0]![1].roomCode;
    expect(notify.mock.calls.map((c) => [c[0], c[1].roomCode])).toEqual([
      [alice.userId, roomCode],
      [bob.userId, roomCode],
    ]);
    const room = (await t.store.getRoom(notify.mock.calls[0]![1].roomId))!;
    expect(room).toMatchObject({
      status: 'playing',
      ranked: true,
      gameId: 'caro',
      timeControl: { type: 'fischer' },
    });
    expect(await t.store.queueBuckets()).toEqual([]);
  });

  it('keeps games, time controls and ranked/casual apart', async () => {
    const { mm, notify } = setup();
    await mm.join(alice, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    await mm.join(bob, { gameId: 'caro', timeControl: 'rapid', ranked: true });
    await mm.join(carol, { gameId: 'caro', timeControl: 'blitz', ranked: false });
    expect(notify).not.toHaveBeenCalled();
  });

  it('ranked: far-apart ratings are paired only after the window has widened', async () => {
    const { t, mm, notify, tick } = setup();
    await setRating(t, alice.userId, 1500);
    await setRating(t, bob.userId, 2000);
    await mm.join(alice, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    await mm.join(bob, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    expect(notify).not.toHaveBeenCalled();
    tick(25_000); // window 400 < 500
    await mm.sweep();
    expect(notify).not.toHaveBeenCalled();
    tick(10_000); // window 500
    await mm.sweep();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('casual games ignore ratings', async () => {
    const { t, mm, notify } = setup();
    await setRating(t, alice.userId, 1000);
    await setRating(t, bob.userId, 2400);
    await mm.join(alice, { gameId: 'caro', timeControl: 'blitz', ranked: false });
    await mm.join(bob, { gameId: 'caro', timeControl: 'blitz', ranked: false });
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('the longest-waiting player gets the closest rating', async () => {
    const { t, mm, notify } = setup();
    const bucket = 'caro|none|ranked';
    // Alice has waited longest; Carol is closer to her rating than Bob.
    await t.store.queuePut(bucket, { userId: alice.userId, name: 'Alice', rating: 1500, joinedAt: 999_000 });
    await t.store.queuePut(bucket, { userId: bob.userId, name: 'Bob', rating: 1620, joinedAt: 999_500 });
    await t.store.queuePut(bucket, { userId: carol.userId, name: 'Carol', rating: 1540, joinedAt: 999_800 });
    await mm.sweep();
    expect(notify.mock.calls.map((c) => c[0]).sort()).toEqual([alice.userId, carol.userId].sort());
    expect((await t.store.queueEntries(bucket)).map((e) => e.userId)).toEqual([bob.userId]);
  });

  it('leaving the queue, or joining another bucket, removes the old entry', async () => {
    const { t, mm, notify } = setup();
    await mm.join(alice, { gameId: 'caro', timeControl: 'blitz', ranked: true });
    await mm.join(alice, { gameId: 'reversi', timeControl: 'blitz', ranked: true });
    expect(await t.store.queueBuckets()).toEqual(['reversi|blitz|ranked']);
    await mm.leave(alice.userId);
    await mm.join(bob, { gameId: 'reversi', timeControl: 'blitz', ranked: true });
    expect(notify).not.toHaveBeenCalled();
  });

  it('rejects unknown games', async () => {
    const { mm } = setup();
    expect(await code(mm.join(alice, { gameId: 'nope', timeControl: 'blitz', ranked: true }))).toBe(
      'game.not_found',
    );
  });

  it('rating windows widen with waiting time, up to a cap', () => {
    expect(ratingWindow(0)).toBe(150);
    expect(ratingWindow(10_000)).toBe(250);
    expect(ratingWindow(10 * 60_000)).toBe(600);
  });
});
