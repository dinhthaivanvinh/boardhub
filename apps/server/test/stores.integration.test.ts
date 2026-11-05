import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type Ack,
  type AuthResponse,
  type MatchSnapshot,
  type RoomSnapshot,
} from '@bg/protocol';
import { buildServer } from '../src/app';
import { InlineBotRunner } from '../src/bots/bot-runner';
import { loadConfig } from '../src/config';
import { createDb, migrateToLatest } from '../src/db/database';
import { PgHistoryRepo, PgOfficeRepo, PgUserRepo } from '../src/db/pg-repos';
import { RedisOfficeStore, type OfficeSessionRecord } from '../src/office/store';
import type { Room } from '../src/domain/types';
import { GameHub } from '../src/hub/game-hub';
import { TimerJobScheduler } from '../src/hub/scheduler';
import { GAME_DEFS } from '../src/registry';
import { RedisLiveStore } from '../src/store/redis-live-store';
import { alice, bob, silentLog } from './helpers';

const REDIS_URL = process.env.REDIS_URL!;
const DATABASE_URL = process.env.DATABASE_URL!;

const db = createDb(DATABASE_URL);
const redis = new Redis(REDIS_URL);
const store = new RedisLiveStore(redis);

beforeAll(async () => {
  await migrateToLatest(db);
  // Users referenced by match_players must exist.
  const users = new PgUserRepo(db);
  for (const u of [alice, bob]) {
    if (!(await users.findById(uuidFor(u.userId)))) {
      await users.create({
        id: uuidFor(u.userId),
        kind: 'guest',
        displayName: u.name,
        email: null,
        passwordHash: null,
      });
    }
  }
});

afterAll(async () => {
  await store.close();
  await db.destroy();
});

/** Stable UUIDs for the test actors (Postgres user ids are uuid). */
function uuidFor(id: string): string {
  return id === alice.userId
    ? '00000000-0000-4000-8000-00000000a11c'
    : '00000000-0000-4000-8000-000000000b0b';
}

describe('RedisLiveStore', () => {
  it('stores rooms, codes, matches and trims chat', async () => {
    const id = randomUUID();
    const code = randomUUID().slice(0, 6).toUpperCase();
    const room = { id, code, seats: [null, null] } as unknown as Room;
    await store.saveRoom(room);
    expect(await store.getRoom(id)).toEqual(room);
    expect(await store.roomIdByCode(code)).toBe(id);
    expect(await store.getRoom('missing')).toBeNull();

    for (let i = 0; i < 5; i++) {
      await store.appendChat(
        { id: `${i}`, roomId: id, from: { userId: 'u', name: 'U' }, text: `m${i}`, at: i },
        3,
      );
    }
    expect((await store.getChat(id)).map((m) => m.text)).toEqual(['m2', 'm3', 'm4']);
  });

  it('withLock serialises concurrent work on the same key', async () => {
    const key = `test-${randomUUID()}`;
    let counter = 0;
    const order: string[] = [];
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        store.withLock(key, async () => {
          const seen = counter;
          order.push(`start${i}`);
          await new Promise((r) => setTimeout(r, 5));
          counter = seen + 1;
          order.push(`end${i}`);
        }),
      ),
    );
    expect(counter).toBe(5);
    // Every start is directly followed by its own end: no interleaving.
    for (let i = 0; i < order.length; i += 2) expect(order[i]!.slice(5)).toBe(order[i + 1]!.slice(3));
  });

  it('releases the lock when the work fails', async () => {
    const key = `test-${randomUUID()}`;
    await expect(store.withLock(key, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await store.withLock(key, async () => 'again')).toBe('again');
  });
});

describe('Postgres repos', () => {
  it('creates, finds and updates users; emails are unique', async () => {
    const users = new PgUserRepo(db);
    const email = `${randomUUID()}@example.com`;
    const u = await users.create({
      id: randomUUID(),
      kind: 'registered',
      displayName: 'Pg',
      email,
      passwordHash: 'h',
    });
    expect(await users.findByEmail(email)).toMatchObject({ id: u.id, displayName: 'Pg' });
    expect(await users.update(u.id, { displayName: 'Pg2' })).toMatchObject({ displayName: 'Pg2' });
    expect(await users.update(u.id, {})).toMatchObject({ displayName: 'Pg2' });
    await expect(
      users.create({ id: randomUUID(), kind: 'registered', displayName: 'Dup', email, passwordHash: 'h' }),
    ).rejects.toThrow();
  });

  it('stores the office avatar as JSON on the user', async () => {
    const users = new PgUserRepo(db);
    const u = await users.create({
      id: randomUUID(),
      kind: 'guest',
      displayName: 'Ava',
      email: null,
      passwordHash: null,
    });
    expect(await users.getAvatar(u.id)).toBeNull();
    const avatar = { v: 1, species: 'owl', body: '#b45309', accent: '#fef3c7' };
    expect(await users.setAvatar(u.id, avatar)).toBe(true);
    expect(await users.getAvatar(u.id)).toEqual(avatar);
    expect(await users.setAvatar(randomUUID(), avatar)).toBe(false);
  });

  it('a full match through the hub lands in Redis and Postgres', async () => {
    const history = new PgHistoryRepo(db);
    const a = { userId: uuidFor(alice.userId), name: 'Alice' };
    const b = { userId: uuidFor(bob.userId), name: 'Bob' };
    const hub = new GameHub({
      store,
      history,
      games: GAME_DEFS,
      bots: new InlineBotRunner(),
      jobs: new TimerJobScheduler(),
      notifier: { roomUpdated() {}, matchUpdated() {}, chatMessage() {} },
      log: silentLog,
    });
    const room = await hub.createRoom(a, {
      gameId: 'four-in-a-row',
      timeControl: { type: 'none' },
      disconnectPolicy: 'forfeit',
      hostSeat: 0,
    });
    await hub.joinRoom(b, room.code);
    await hub.takeSeat(b, room.id, 1);
    await hub.setReady(b, room.id, true);
    await hub.startMatch(a, room.id);
    const matchId = (await store.getRoom(room.id))!.matchId!;
    const cols = [0, 1, 0, 1, 0, 1, 0];
    for (let i = 0; i < cols.length; i++) {
      const m = (await store.getMatch(matchId))!;
      await hub.submitMove(i % 2 === 0 ? a : b, {
        matchId,
        seq: m.seq,
        clientMoveId: `pg-${i}-${matchId}`,
        move: { col: cols[i] },
      });
    }
    const row = await db
      .selectFrom('matches')
      .selectAll()
      .where('id', '=', matchId)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({
      status: 'finished',
      game_id: 'four-in-a-row',
      result: { kind: 'win', winners: [0] },
    });
    const moves = await db
      .selectFrom('match_moves')
      .select(['idx', 'seat', 'move'])
      .where('match_id', '=', matchId)
      .orderBy('idx')
      .execute();
    expect(moves.map((m) => m.move)).toEqual(cols.map((col) => ({ col })));
    const players = await db
      .selectFrom('match_players')
      .selectAll()
      .where('match_id', '=', matchId)
      .orderBy('seat')
      .execute();
    expect(players.map((p) => p.user_id)).toEqual([a.userId, b.userId]);

    // Read side used by the profile and replay pages.
    const listed = await history.listForUser(a.userId, 50);
    expect(listed.find((m) => m.id === matchId)).toMatchObject({
      status: 'finished',
      gameId: 'four-in-a-row',
    });
    const stored = await history.getMatch(matchId);
    expect(stored?.moves.map((m) => m.move)).toEqual(cols.map((col) => ({ col })));
    expect(stored?.players.map((p) => p.userId)).toEqual([a.userId, b.userId]);
    expect(await history.getMatch('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('two server processes sharing Redis', () => {
  type Client = Socket;
  const servers: Awaited<ReturnType<typeof buildServer>>[] = [];
  const clients: Client[] = [];

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    for (const s of servers) await s.close();
  });

  async function start() {
    const s = await buildServer(
      loadConfig({ LOG_LEVEL: 'silent', BOT_WORKERS: '0', REDIS_URL, DATABASE_URL }),
    );
    await s.app.listen({ port: 0, host: '127.0.0.1' });
    servers.push(s);
    const address = s.app.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    return { server: s, url: `http://127.0.0.1:${address.port}` };
  }

  const emit = <R>(c: Client, event: string, payload: unknown) =>
    new Promise<Ack<R>>((resolve) => c.emit(event, payload, resolve));
  const ok = async <R>(c: Client, event: string, payload: unknown) => {
    const res = await emit<R>(c, event, payload);
    if (!res.ok) throw new Error(`${event}: ${res.code}`);
    return res.data;
  };

  it('a player on node A and a player on node B play together', async () => {
    const [nodeA, nodeB] = [await start(), await start()];
    const guest = async (srv: typeof nodeA.server, name: string) =>
      (
        await srv.app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: name } })
      ).json<AuthResponse>();
    // Users live in Postgres, so a token from node A works on node B.
    const [ga, gb] = [await guest(nodeA.server, 'Node A'), await guest(nodeA.server, 'Node B')];
    const open = (url: string, token: string) =>
      new Promise<Client>((resolve, reject) => {
        const c = connect(url, {
          auth: { token, protocolVersion: PROTOCOL_VERSION },
          transports: ['websocket'],
          reconnection: false,
        });
        clients.push(c);
        c.once('connect', () => resolve(c));
        c.once('connect_error', reject);
      });
    const [ca, cb] = [await open(nodeA.url, ga.token), await open(nodeB.url, gb.token)];

    const { room } = await ok<{ room: RoomSnapshot }>(ca, 'room:create', { gameId: 'four-in-a-row' });
    await ok(cb, 'room:join', { code: room.code });
    await ok(cb, 'room:take-seat', { roomId: room.id, seat: 1 });
    await ok(cb, 'room:set-ready', { roomId: room.id, ready: true });

    const bobSees = new Promise<MatchSnapshot>((resolve) =>
      cb.on('match:state', (m: MatchSnapshot) => m.moveCount === 1 && resolve(m)),
    );
    const aliceStarted = new Promise<MatchSnapshot>((resolve) => ca.once('match:state', resolve));
    await ok(ca, 'room:start', { roomId: room.id });
    const m = await aliceStarted;
    await ok(ca, 'move:submit', {
      matchId: m.matchId,
      seq: 0,
      clientMoveId: `cross-${m.matchId}`,
      move: { col: 3 },
    });
    // The update was produced on node A and reached Bob's socket on node B through the Redis adapter.
    expect((await bobSees).mySeat).toBe(1);
  });
});

describe('M4a storage', () => {
  it('Redis keeps the quick-match queue and the live list', async () => {
    const bucket = `test|${randomUUID()}|ranked`;
    const other = `test|${randomUUID()}|casual`;
    const [u1, u2] = [randomUUID(), randomUUID()];
    await store.queuePut(bucket, { userId: u1, name: 'One', rating: 1500, joinedAt: 1 });
    await store.queuePut(bucket, { userId: u2, name: 'Two', rating: 1600, joinedAt: 2 });
    expect((await store.queueEntries(bucket)).map((e) => e.userId).sort()).toEqual([u1, u2].sort());
    expect(await store.queueBuckets()).toContain(bucket);
    // Joining another bucket moves the user.
    await store.queuePut(other, { userId: u1, name: 'One', rating: 1500, joinedAt: 3 });
    expect((await store.queueEntries(bucket)).map((e) => e.userId)).toEqual([u2]);
    expect(await store.queueRemove(u2)).toBe(bucket);
    expect(await store.queueBuckets()).not.toContain(bucket);
    expect(await store.queueRemove(u2)).toBeNull();
    await store.queueRemove(u1);

    const room = randomUUID();
    await store.setLive(room, true);
    expect(await store.liveRoomIds()).toContain(room);
    await store.setLive(room, false);
    expect(await store.liveRoomIds()).not.toContain(room);
  });

  it('Postgres stores ratings and ranks the leaderboard', async () => {
    const { PgRatingRepo } = await import('../src/db/pg-repos');
    const repo = new PgRatingRepo(db);
    const users = new PgUserRepo(db);
    const game = `test-${randomUUID()}`;
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) {
      await users.create({
        id,
        kind: 'guest',
        displayName: `R${id.slice(0, 4)}`,
        email: null,
        passwordHash: null,
      });
    }
    expect(await repo.get(ids[0]!, game)).toMatchObject({ rating: 1500, rd: 350, games: 0 });
    const base = { gameId: game, rd: 80, volatility: 0.06, wins: 0, losses: 0, draws: 0 };
    await repo.save({ ...base, userId: ids[0]!, rating: 1700, games: 6 });
    await repo.save({ ...base, userId: ids[1]!, rating: 1800, games: 2 });
    await repo.save({ ...base, userId: ids[2]!, rating: 1600, games: 9 });
    await repo.save({ ...base, userId: ids[2]!, rating: 1650, games: 10 }); // upsert
    expect((await repo.top(game, 10, 5)).map((r) => [r.userId, r.rating])).toEqual([
      [ids[0], 1700],
      [ids[2], 1650],
    ]);
    expect(await repo.forUser(ids[2]!)).toEqual([expect.objectContaining({ gameId: game, games: 10 })]);
  });
});

describe('office storage', () => {
  it('Redis keeps whole sessions', async () => {
    const store = new RedisOfficeStore(redis);
    const code = randomUUID().slice(0, 6).toUpperCase();
    const session: OfficeSessionRecord = {
      code,
      activityId: 'lucky-animal',
      title: 'T',
      hostId: 'h',
      status: 'open',
      createdAt: 1,
      lastActiveAt: 1,
      seq: 1,
      participants: [],
      kicked: [],
      state: { rounds: [] },
    };
    expect(await store.get(code)).toBeNull();
    await store.save(session);
    expect(await store.get(code)).toEqual(session);
    expect(await redis.ttl(`office:${code}`)).toBeGreaterThan(24 * 3600);
  });

  it('Postgres records sessions; a reused code starts a fresh record', async () => {
    const repo = new PgOfficeRepo(db);
    const users = new PgUserRepo(db);
    const host = await users.create({
      id: randomUUID(),
      kind: 'guest',
      displayName: 'H',
      email: null,
      passwordHash: null,
    });
    const code = randomUUID().slice(0, 6).toUpperCase();
    await repo.created({
      code,
      activityId: 'lucky-animal',
      title: 'Một',
      hostId: host.id,
      createdAt: Date.now(),
    });
    await repo.statusChanged(code, 'closed', Date.now());
    let row = await db
      .selectFrom('office_sessions')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ status: 'closed', title: 'Một' });
    expect(row.closed_at).not.toBeNull();
    await repo.created({
      code,
      activityId: 'lucky-animal',
      title: 'Hai',
      hostId: host.id,
      createdAt: Date.now(),
    });
    row = await db
      .selectFrom('office_sessions')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ status: 'open', title: 'Hai', closed_at: null });
  });
});

describe('office draws in Postgres', () => {
  it('a revealed draw is stored once and read back exactly', async () => {
    const repo = new PgOfficeRepo(db);
    const code = randomUUID().slice(0, 6).toUpperCase();
    const record = {
      drawId: randomUUID(),
      round: 1,
      mode: 'race',
      n: 1,
      candidates: [{ id: 'a', name: 'An', avatar: { v: 1 } as never }],
      commitment: 'c'.repeat(64),
      seed: 'd'.repeat(64),
      winners: ['a'],
      startsAt: 1_000,
      revealAt: 4_000,
      revealedAt: 3_600,
    };
    expect(await repo.getDraw(code, record.drawId)).toBeNull();
    await repo.drawRevealed(code, record);
    await repo.drawRevealed(code, record); // a repeated reveal job writes nothing new
    expect(await repo.getDraw(code, record.drawId)).toEqual(record);
    expect(await repo.getDraw('OTHER1', record.drawId)).toBeNull();
    expect(await repo.getDraw(code, 'not-a-uuid')).toBeNull();
  });
});
