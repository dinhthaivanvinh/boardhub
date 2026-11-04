import { describe, expect, it } from 'vitest';
import { HubError } from '../src/errors';
import { alice, bob, carol, lastSnapshotFor, makeHub, moveId, play, startTwoPlayer } from './helpers';

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof HubError ? e.code : `unexpected: ${String(e)}`),
  );

// Caro cells on the default 15x15 board.
const at = (row: number, col: number) => row * 15 + col;

describe('rooms', () => {
  it('creates a lobby with the host seated and a unique code', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      config: { size: 19 },
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    expect(room).toMatchObject({
      status: 'lobby',
      hostId: alice.userId,
      code: 'CODE01',
      config: { size: 19 },
    });
    expect(room.seats).toEqual([
      { kind: 'user', userId: alice.userId, name: 'Alice', ready: false, connected: true, graceUntil: null },
      null,
    ]);
  });

  it('rejects unknown games and bad config', async () => {
    const t = makeHub();
    const base = {
      timeControl: { type: 'none' } as const,
      disconnectPolicy: 'forfeit' as const,
      hostSeat: 0,
    };
    expect(await code(t.hub.createRoom(alice, { ...base, gameId: 'chess-960' }))).toBe('game.not_found');
    expect(await code(t.hub.createRoom(alice, { ...base, gameId: 'caro', config: { size: 17 } }))).toBe(
      'invalid.payload',
    );
    expect(await code(t.hub.createRoom(alice, { ...base, gameId: 'caro', hostSeat: 5 }))).toBe(
      'invalid.payload',
    );
  });

  it('joining makes you a spectator until you take a seat', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    const joined = await t.hub.joinRoom(bob, room.code);
    expect(joined.room.spectatorCount).toBe(1);
    expect(joined.match).toBeNull();
    expect(await code(t.hub.joinRoom(bob, 'NOPE00'))).toBe('room.not_found');

    await t.hub.takeSeat(bob, room.id, 1);
    expect(await code(t.hub.takeSeat(carol, room.id, 1))).toBe('room.seat_taken');
    expect(await code(t.hub.takeSeat(carol, room.id, 9))).toBe('invalid.payload');
    expect(t.events.rooms.at(-1)).toMatchObject({
      spectatorCount: 0,
      seats: [{ userId: 'u-alice' }, { userId: 'u-bob' }],
    });

    await t.hub.takeSeat(bob, room.id, null); // stand up
    expect(t.events.rooms.at(-1)).toMatchObject({ spectatorCount: 1, seats: [{ userId: 'u-alice' }, null] });
  });

  it('only the host can start, and only when seats are filled and everyone is ready', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    expect(await code(t.hub.startMatch(alice, room.id))).toBe('room.not_ready');
    await t.hub.joinRoom(bob, room.code);
    await t.hub.takeSeat(bob, room.id, 1);
    expect(await code(t.hub.startMatch(bob, room.id))).toBe('room.not_host');
    expect(await code(t.hub.startMatch(alice, room.id))).toBe('room.not_ready');
    expect(await code(t.hub.setReady(carol, room.id, true))).toBe('room.not_seated');
    await t.hub.setReady(bob, room.id, true);
    await t.hub.startMatch(alice, room.id);
    expect(t.events.rooms.at(-1)?.status).toBe('playing');
    expect(await code(t.hub.startMatch(alice, room.id))).toBe('room.invalid_state');
    expect(await code(t.hub.takeSeat(carol, room.id, 0))).toBe('room.invalid_state');
  });

  it('the host can add and remove bots in the lobby', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await t.hub.joinRoom(bob, room.code);
    expect(await code(t.hub.addBot(bob, room.id, 1, 'easy'))).toBe('room.not_host');
    await t.hub.addBot(alice, room.id, 1, 'easy');
    expect(await code(t.hub.addBot(alice, room.id, 1, 'easy'))).toBe('room.seat_taken');
    expect(t.events.rooms.at(-1)?.seats[1]).toEqual({ kind: 'bot', level: 'easy' });
    expect(await code(t.hub.removeBot(alice, room.id, 0))).toBe('invalid.payload');
    await t.hub.removeBot(alice, room.id, 1);
    expect(t.events.rooms.at(-1)?.seats[1]).toBeNull();
  });

  it('leaving the lobby frees the seat and passes the host role on', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await t.hub.joinRoom(bob, room.code);
    await t.hub.takeSeat(bob, room.id, 1);
    await t.hub.leaveRoom(alice, room.id);
    expect(t.events.rooms.at(-1)).toMatchObject({
      hostId: bob.userId,
      seats: [null, { userId: bob.userId }],
    });
  });

  it('chat reaches the room and masks rude words; outsiders cannot post', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await t.hub.chat(alice, room.id, 'chào, đồ shit');
    expect(t.events.chats.at(-1)).toMatchObject({ text: 'chào, đồ ****', from: { name: 'Alice' } });
    expect(await code(t.hub.chat(carol, room.id, 'hi'))).toBe('room.not_found');
    const joined = await t.hub.joinRoom(bob, room.code);
    expect(joined.chat.map((m) => m.text)).toEqual(['chào, đồ ****']);
  });
});

describe('matches', () => {
  it('each player is told their own seat; spectators get no seat', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    const update = t.events.matches.at(-1)!;
    expect(update.perUser.map((p) => [p.userId, p.snapshot.mySeat])).toEqual([
      [alice.userId, 0],
      [bob.userId, 1],
    ]);
    expect(update.spectators).toMatchObject({
      matchId,
      mySeat: null,
      seq: 0,
      activeSeats: [0],
      result: null,
    });
    expect(t.history.matches.get(matchId)?.players).toEqual([
      { seat: 0, userId: alice.userId, botLevel: null },
      { seat: 1, userId: bob.userId, botLevel: null },
    ]);
  });

  it('applies moves in turn and rejects stale, out-of-turn, illegal and outsider moves', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    expect(await play(t, alice, matchId, { cell: at(7, 7) })).toEqual({ seq: 1 });
    expect(
      await code(t.hub.submitMove(bob, { matchId, seq: 0, clientMoveId: moveId(), move: { cell: 1 } })),
    ).toBe('match.stale_seq');
    expect(await code(play(t, alice, matchId, { cell: 1 }))).toBe('engine.not_your_turn');
    expect(await code(play(t, bob, matchId, { cell: at(7, 7) }))).toBe('caro.cell_occupied');
    expect(await code(play(t, bob, matchId, { row: 1 }))).toBe('engine.invalid_move_shape');
    expect(await code(play(t, carol, matchId, { cell: 3 }))).toBe('match.not_player');
    expect(
      await code(
        t.hub.submitMove(alice, { matchId: 'nope', seq: 0, clientMoveId: moveId(), move: { cell: 3 } }),
      ),
    ).toBe('match.not_found');
  });

  it('a resent move (same clientMoveId) is applied only once', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    const input = { matchId, seq: 0, clientMoveId: 'same-id-123', move: { cell: 5 } };
    expect(await t.hub.submitMove(alice, input)).toEqual({ seq: 1 });
    expect(await t.hub.submitMove(alice, input)).toEqual({ seq: 1 });
    expect((await t.store.getMatch(matchId))!.moves).toHaveLength(1);
  });

  it('plays to a win, ends the match and records history', async () => {
    const t = makeHub();
    const { roomId, matchId } = await startTwoPlayer(t);
    for (let i = 0; i < 4; i++) {
      await play(t, alice, matchId, { cell: at(7, 3 + i) });
      await play(t, bob, matchId, { cell: at(0, i * 2) });
    }
    await play(t, alice, matchId, { cell: at(7, 7) });
    expect(lastSnapshotFor(t, bob.userId)?.result).toEqual({
      kind: 'win',
      winners: [0],
      reason: 'five_in_row',
    });
    expect(t.events.rooms.at(-1)).toMatchObject({ id: roomId, status: 'finished' });
    const row = t.history.matches.get(matchId)!;
    expect(row.moves).toHaveLength(9);
    expect(row.result).toMatchObject({ winners: [0] });
    expect(await code(play(t, bob, matchId, { cell: 100 }))).toBe('engine.game_over');
  });

  it('resign gives the win to the opponent', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    await t.hub.matchAction(bob, matchId, 'resign');
    expect(lastSnapshotFor(t, alice.userId)?.result).toEqual({ kind: 'win', winners: [0], reason: 'resign' });
  });

  it('draw offers can be declined or accepted, but not by the one who offered', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    expect(await code(t.hub.matchAction(bob, matchId, 'accept-draw'))).toBe('match.no_offer');
    await t.hub.matchAction(alice, matchId, 'offer-draw');
    expect(lastSnapshotFor(t, bob.userId)?.pendingOffer).toEqual({ type: 'draw', from: 0 });
    expect(await code(t.hub.matchAction(alice, matchId, 'accept-draw'))).toBe('match.no_offer');
    await t.hub.matchAction(bob, matchId, 'decline-draw');
    expect(lastSnapshotFor(t, alice.userId)?.pendingOffer).toBeNull();

    await t.hub.matchAction(bob, matchId, 'offer-draw');
    await play(t, alice, matchId, { cell: 0 }); // a move cancels the offer
    expect(lastSnapshotFor(t, alice.userId)?.pendingOffer).toBeNull();
    await t.hub.matchAction(bob, matchId, 'offer-draw');
    await t.hub.matchAction(alice, matchId, 'accept-draw');
    expect(lastSnapshotFor(t, alice.userId)?.result).toEqual({ kind: 'draw', reason: 'agreement' });
  });

  it('resync returns the caller own view', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t);
    expect((await t.hub.resync(bob, matchId)).mySeat).toBe(1);
    expect(await code(t.hub.resync(carol, matchId))).toBe('room.not_found');
  });

  it('rematch returns to the lobby with seats swapped', async () => {
    const t = makeHub();
    const { roomId, matchId } = await startTwoPlayer(t);
    expect(await code(t.hub.rematch(alice, roomId))).toBe('room.invalid_state');
    await t.hub.matchAction(alice, matchId, 'resign');
    expect(await code(t.hub.rematch(carol, roomId))).toBe('room.not_seated');
    await t.hub.rematch(bob, roomId);
    expect(t.events.rooms.at(-1)).toMatchObject({
      status: 'lobby',
      matchId: null,
      seats: [
        { userId: bob.userId, ready: false },
        { userId: alice.userId, ready: false },
      ],
    });
  });
});

describe('clocks', () => {
  const blitz = { type: 'fischer', baseMs: 10_000, incrementMs: 2_000 } as const;

  it('charges the mover, adds the increment and runs the opponent clock', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t, 'caro', { timeControl: blitz });
    t.skip(3_000);
    await play(t, alice, matchId, { cell: 1 });
    expect(lastSnapshotFor(t, alice.userId)?.clocks).toEqual([
      { seat: 0, remainingMs: 9_000, running: false },
      { seat: 1, remainingMs: 10_000, running: true },
    ]);
  });

  it('the timer ends the match when the running clock reaches zero', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t, 'caro', { timeControl: blitz });
    await play(t, alice, matchId, { cell: 1 });
    await t.advance(9_999);
    expect(lastSnapshotFor(t, alice.userId)?.result).toBeNull();
    await t.advance(1);
    expect(lastSnapshotFor(t, alice.userId)?.result).toEqual({
      kind: 'win',
      winners: [0],
      reason: 'timeout',
    });
    expect(lastSnapshotFor(t, alice.userId)?.clocks?.[1]).toEqual({
      seat: 1,
      remainingMs: 0,
      running: false,
    });
  });

  it('a late move is refused even if the timer has not fired yet', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t, 'caro', { timeControl: blitz });
    t.skip(10_001);
    expect(await code(play(t, alice, matchId, { cell: 1 }))).toBe('engine.game_over');
    expect(lastSnapshotFor(t, bob.userId)?.result).toMatchObject({ winners: [1], reason: 'timeout' });
  });

  it('per-move clocks reset after every move', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t, 'caro', {
      timeControl: { type: 'per-move', moveMs: 30_000 },
    });
    t.skip(20_000);
    await play(t, alice, matchId, { cell: 1 });
    t.skip(25_000);
    await play(t, bob, matchId, { cell: 2 });
    expect(lastSnapshotFor(t, alice.userId)?.clocks?.map((c) => c.remainingMs)).toEqual([30_000, 30_000]);
  });
});

describe('bots', () => {
  it('a bot seat moves on its own after a short delay', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'four-in-a-row',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await t.hub.addBot(alice, room.id, 1, 'easy');
    await t.hub.startMatch(alice, room.id);
    const matchId = (await t.store.getRoom(room.id))!.matchId!;
    await play(t, alice, matchId, { col: 3 });
    expect(t.scheduler.has('bot:')).toBe(true);
    await t.advance(399);
    expect((await t.store.getMatch(matchId))!.moves).toHaveLength(1);
    await t.advance(1);
    const match = (await t.store.getMatch(matchId))!;
    expect(match.moves).toHaveLength(2);
    expect(match.moves[1]?.seat).toBe(1);
    expect(t.history.matches.get(matchId)?.players[1]).toEqual({ seat: 1, userId: null, botLevel: 'easy' });
  });

  it('a bot that moves first starts right away', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'four-in-a-row',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 1,
    });
    await t.hub.addBot(alice, room.id, 0, 'medium');
    await t.hub.startMatch(alice, room.id);
    await t.advance(400);
    expect(lastSnapshotFor(t, alice.userId)).toMatchObject({ moveCount: 1, activeSeats: [1], mySeat: 1 });
  });
});

describe('disconnects', () => {
  it('a player who comes back within the grace period keeps the seat', async () => {
    const t = makeHub();
    const { roomId, code: roomCode } = await startTwoPlayer(t);
    await t.hub.disconnected(bob.userId, roomId);
    expect(t.events.rooms.at(-1)?.seats[1]).toMatchObject({ connected: false, graceUntil: t.now() + 60_000 });
    await t.advance(30_000);
    const joined = await t.hub.joinRoom(bob, roomCode);
    expect(joined.room.seats[1]).toMatchObject({ connected: true, graceUntil: null });
    expect(joined.match?.mySeat).toBe(1);
    await t.advance(60_000);
    expect(t.events.rooms.at(-1)?.status).toBe('playing');
  });

  it('forfeit policy: the absent player loses when the grace period ends', async () => {
    const t = makeHub();
    const { roomId } = await startTwoPlayer(t);
    await t.hub.disconnected(bob.userId, roomId);
    await t.advance(60_000);
    expect(lastSnapshotFor(t, alice.userId)?.result).toEqual({
      kind: 'win',
      winners: [0],
      reason: 'abandon',
    });
  });

  it('bot policy: a bot takes over the seat and keeps playing', async () => {
    const t = makeHub();
    const { roomId, matchId } = await startTwoPlayer(t, 'four-in-a-row', { disconnectPolicy: 'bot' });
    await play(t, alice, matchId, { col: 3 });
    await t.hub.disconnected(bob.userId, roomId);
    await t.advance(60_000);
    expect(t.events.rooms.at(-1)?.seats[1]).toEqual({ kind: 'bot', level: 'medium' });
    await t.advance(400);
    expect((await t.store.getMatch(matchId))!.moves).toHaveLength(2);
  });

  it('in the lobby the seat is freed after the grace period; spectators just leave', async () => {
    const t = makeHub();
    const room = await t.hub.createRoom(alice, {
      gameId: 'caro',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await t.hub.joinRoom(bob, room.code);
    await t.hub.joinRoom(carol, room.code);
    await t.hub.takeSeat(bob, room.id, 1);
    await t.hub.disconnected(carol.userId, room.id);
    expect(t.events.rooms.at(-1)?.spectatorCount).toBe(0);
    await t.hub.disconnected(bob.userId, room.id);
    await t.advance(60_000);
    expect(t.events.rooms.at(-1)?.seats[1]).toBeNull();
  });
});

describe('hidden information', () => {
  it('never sends a player the other player secret', async () => {
    const t = makeHub();
    const { matchId } = await startTwoPlayer(t, 'secret');
    const match = (await t.store.getMatch(matchId))!;
    const [secretA, secretB] = (match.state as { secrets: number[] }).secrets;
    const update = t.events.matches.at(-1)!;
    const forAlice = JSON.stringify(update.perUser.find((p) => p.userId === alice.userId)!.snapshot);
    const forBob = JSON.stringify(update.perUser.find((p) => p.userId === bob.userId)!.snapshot);
    expect(forAlice).toContain(`"mySecret":${secretA}`);
    expect(forAlice).not.toContain(`"mySecret":${secretB}`);
    expect(forBob).toContain(`"mySecret":${secretB}`);
    expect(update.spectators.view).toEqual({ mySecret: null, turn: 0 });
    // The seed would let a client recompute secrets: it must never appear in a snapshot.
    expect(forAlice).not.toContain('"seed"');
  });
});
