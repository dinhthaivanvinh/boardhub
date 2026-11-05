import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type Ack,
  type AuthResponse,
  type ClientToServerEvents,
  type MatchDetail,
  type MatchSnapshot,
  type MatchSummary,
  type LiveRoom,
  type UserRating,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '@bg/protocol';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: Awaited<ReturnType<typeof buildServer>>;
let url: string;
const sockets: Client[] = [];

beforeAll(async () => {
  server = await buildServer(
    loadConfig({ LOG_LEVEL: 'silent', BOT_WORKERS: '0', BOT_DELAY_MS: '0', GRACE_MS: '1000' }),
  );
  await server.app.listen({ port: 0, host: '127.0.0.1' });
  const address = server.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
});

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: T }> {
  const res = await server.app.inject({
    method: method as 'GET',
    url: path,
    ...(body !== undefined && { payload: body as object }),
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: res.json() as T };
}

async function guest(name: string): Promise<AuthResponse> {
  return (await api<AuthResponse>('POST', '/api/auth/guest', { displayName: name })).body;
}

function open(token: string, protocolVersion = PROTOCOL_VERSION): Promise<Client> {
  const socket: Client = connect(url, {
    auth: { token, protocolVersion },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function emit<R>(socket: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<Ack<R>> {
  return new Promise((resolve) =>
    (socket.emit as (e: string, p: unknown, ack: (r: Ack<R>) => void) => void)(event, payload, resolve),
  );
}

async function ok<R>(socket: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<R> {
  const res = await emit<R>(socket, event, payload);
  if (!res.ok) throw new Error(`${event} failed: ${res.code}`);
  return res.data;
}

/** Resolves with the next event matching the predicate. */
function next<E extends keyof ServerToClientEvents>(
  socket: Client,
  event: E,
  predicate: (arg: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => {
    const handler = (arg: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!predicate(arg)) return;
      (socket.off as (e: string, h: unknown) => void)(event, handler);
      resolve(arg);
    };
    (socket.on as (e: string, h: unknown) => void)(event, handler);
  });
}

describe('REST auth', () => {
  it('guest, rename, register (keeps the id), login', async () => {
    const g = await guest('Khách');
    expect(g.user).toMatchObject({ kind: 'guest', displayName: 'Khách', email: null });
    expect((await api('GET', '/api/me', undefined, g.token)).body).toMatchObject({ id: g.user.id });
    expect((await api('PATCH', '/api/me', { displayName: 'Tên Mới' }, g.token)).body).toMatchObject({
      displayName: 'Tên Mới',
    });

    const reg = await api<AuthResponse>(
      'POST',
      '/api/auth/register',
      { email: 'An@Example.com', password: 'secret-123', displayName: 'An' },
      g.token,
    );
    expect(reg.status).toBe(200);
    expect(reg.body.user).toEqual({
      id: g.user.id,
      kind: 'registered',
      displayName: 'An',
      email: 'an@example.com',
    });

    const login = await api<AuthResponse>('POST', '/api/auth/login', {
      email: 'an@example.com',
      password: 'secret-123',
    });
    expect(login.body.user.id).toBe(g.user.id);
    expect(
      (await api('POST', '/api/auth/login', { email: 'an@example.com', password: 'wrong-pass' })).status,
    ).toBe(401);
    expect(
      (
        await api('POST', '/api/auth/register', {
          email: 'an@example.com',
          password: 'secret-123',
          displayName: 'Bé',
        })
      ).status,
    ).toBe(409);
  });

  it('rejects missing tokens and bad input', async () => {
    expect((await api('GET', '/api/me')).status).toBe(401);
    expect((await api('GET', '/api/me', undefined, 'garbage')).status).toBe(401);
    expect((await api('POST', '/api/auth/guest', { displayName: 'x' })).status).toBe(400);
    expect((await api('GET', '/health')).body).toEqual({ ok: true });
  });

  it('browsers may send PATCH (renaming from the account page)', async () => {
    const res = await server.app.inject({
      method: 'OPTIONS',
      url: '/api/me',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type,authorization',
      },
    });
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });
});

describe('socket handshake', () => {
  it('needs a valid token and the right protocol version', async () => {
    await expect(open('not-a-token')).rejects.toThrow('auth.required');
    const g = await guest('Version');
    await expect(open(g.token, PROTOCOL_VERSION + 1)).rejects.toThrow('protocol.version');
  });
});

describe('online match over sockets', () => {
  it('two guests play Caro through an invite code', async () => {
    const [a, b] = [await guest('Alice'), await guest('Bob')];
    const [sa, sb] = [await open(a.token), await open(b.token)];

    const { room } = await ok<{ room: RoomSnapshot }>(sa, 'room:create', { gameId: 'caro' });
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);

    const joined = await ok<{ room: RoomSnapshot }>(sb, 'room:join', { code: room.code.toLowerCase() });
    expect(joined.room.id).toBe(room.id);

    const seated = next(sa, 'room:updated', (r) => r.seats[1]?.kind === 'user');
    await ok(sb, 'room:take-seat', { roomId: room.id, seat: 1 });
    await seated;
    await ok(sb, 'room:set-ready', { roomId: room.id, ready: true });

    const aliceStart = next(sa, 'match:state');
    const bobStart = next(sb, 'match:state');
    await ok(sa, 'room:start', { roomId: room.id });
    const [ma, mb] = [await aliceStart, await bobStart];
    expect([ma.mySeat, mb.mySeat]).toEqual([0, 1]);

    // Alice: row 7, cols 3..7. Bob: row 0.
    let seq = 0;
    const mover = (i: number) => (i % 2 === 0 ? sa : sb);
    const cells = [108, 0, 109, 2, 110, 4, 111, 6, 112];
    let last: MatchSnapshot | undefined;
    for (let i = 0; i < cells.length; i++) {
      const expected = seq + 1;
      const update = next(sb, 'match:state', (m) => m.seq === expected);
      const res = await ok<{ seq: number }>(mover(i), 'move:submit', {
        matchId: ma.matchId,
        seq,
        clientMoveId: `move-${i}-${room.id}`,
        move: { cell: cells[i] },
      });
      seq = res.seq;
      last = await update;
    }
    expect(last?.result).toEqual({ kind: 'win', winners: [0], reason: 'five_in_row' });
    expect(last?.view).toMatchObject({ winner: 0 });

    const rejected = await emit(sb, 'move:submit', {
      matchId: ma.matchId,
      seq,
      clientMoveId: 'late-move-1',
      move: { cell: 50 },
    });
    expect(rejected).toEqual({ ok: false, code: 'engine.game_over' });

    // Chat goes to everyone in the room.
    const chat = next(sa, 'chat:message');
    await ok(sb, 'chat:send', { roomId: room.id, text: 'gg' });
    expect(await chat).toMatchObject({ text: 'gg', from: { name: 'Bob' } });

    // The finished match is in both players' history and can be replayed.
    const history = await api<{ matches: MatchSummary[] }>('GET', '/api/me/matches', undefined, b.token);
    expect(history.body.matches).toHaveLength(1);
    expect(history.body.matches[0]).toMatchObject({
      id: ma.matchId,
      roomCode: room.code,
      gameId: 'caro',
      status: 'finished',
      result: { kind: 'win', winners: [0] },
      players: [
        { seat: 0, userId: a.user.id, name: 'Alice', botLevel: null },
        { seat: 1, userId: b.user.id, name: 'Bob', botLevel: null },
      ],
    });
    const detail = await api<MatchDetail>('GET', `/api/matches/${ma.matchId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.moves.map((m) => m.move)).toEqual(cells.map((cell) => ({ cell })));
    expect(detail.body.seed.length).toBeGreaterThan(0);
    expect((await api('GET', '/api/me/matches')).status).toBe(401);
  });

  it('a rejected move comes back in the ack with the rule code', async () => {
    const [a, b] = [await guest('Ann'), await guest('Ben')];
    const [sa, sb] = [await open(a.token), await open(b.token)];
    const { room } = await ok<{ room: RoomSnapshot }>(sa, 'room:create', { gameId: 'four-in-a-row' });
    await ok(sb, 'room:join', { code: room.code });
    await ok(sb, 'room:take-seat', { roomId: room.id, seat: 1 });
    await ok(sb, 'room:set-ready', { roomId: room.id, ready: true });
    const started = next(sa, 'match:state');
    await ok(sa, 'room:start', { roomId: room.id });
    const m = await started;
    expect(
      await emit(sa, 'move:submit', {
        matchId: m.matchId,
        seq: 0,
        clientMoveId: 'bad-col-01',
        move: { col: 9 },
      }),
    ).toEqual({
      ok: false,
      code: 'four-in-a-row.out_of_bounds',
    });
    expect(
      await emit(sb, 'move:submit', {
        matchId: m.matchId,
        seq: 0,
        clientMoveId: 'not-turn-1',
        move: { col: 1 },
      }),
    ).toEqual({
      ok: false,
      code: 'engine.not_your_turn',
    });

    // A running match cannot be fetched: its seed and moves must stay private until the end.
    expect(await api('GET', `/api/matches/${m.matchId}`)).toMatchObject({
      status: 409,
      body: { code: 'match.not_finished' },
    });
    expect((await api('GET', '/api/matches/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await api('GET', '/api/matches/not-an-id')).status).toBe(404);
  });

  it('validates payloads and rate-limits floods', async () => {
    const g = await guest('Spam');
    const s = await open(g.token);
    expect(await emit(s, 'room:create', { gameId: 'caro', evil: true })).toEqual({
      ok: false,
      code: 'invalid.payload',
    });
    const results = await Promise.all(
      Array.from({ length: 15 }, () => emit(s, 'room:join', { code: 'ZZZZZZ' })),
    );
    expect(results.filter((r) => !r.ok && r.code === 'rate.limited').length).toBeGreaterThan(0);
  });

  it('plays against a bot over the socket', async () => {
    const g = await guest('Solo');
    const s = await open(g.token);
    const { room } = await ok<{ room: RoomSnapshot }>(s, 'room:create', { gameId: 'four-in-a-row' });
    await ok(s, 'room:add-bot', { roomId: room.id, seat: 1, level: 'easy' });
    const started = next(s, 'match:state');
    await ok(s, 'room:start', { roomId: room.id });
    const m = await started;
    const botMoved = next(s, 'match:state', (x) => x.moveCount === 2);
    await ok(s, 'move:submit', { matchId: m.matchId, seq: 0, clientMoveId: 'solo-move-1', move: { col: 3 } });
    expect((await botMoved).activeSeats).toEqual([0]);
  });

  it('marks a player as disconnected and lets them back in', async () => {
    const [a, b] = [await guest('Stay'), await guest('Drop')];
    const sa = await open(a.token);
    let sb = await open(b.token);
    const { room } = await ok<{ room: RoomSnapshot }>(sa, 'room:create', { gameId: 'caro' });
    await ok(sb, 'room:join', { code: room.code });
    await ok(sb, 'room:take-seat', { roomId: room.id, seat: 1 });
    await ok(sb, 'room:set-ready', { roomId: room.id, ready: true });
    await ok(sa, 'room:start', { roomId: room.id });

    const dropped = next(sa, 'room:updated', (r) => r.seats[1]?.kind === 'user' && !r.seats[1].connected);
    sb.disconnect();
    expect((await dropped).seats[1]).toMatchObject({ connected: false });

    const back = next(sa, 'room:updated', (r) => r.seats[1]?.kind === 'user' && r.seats[1].connected);
    sb = await open(b.token);
    const rejoined = await ok<{ match: MatchSnapshot | null }>(sb, 'room:join', { code: room.code });
    expect(rejoined.match?.mySeat).toBe(1);
    await back;
  });
});

describe('quick match over sockets', () => {
  it('two guests are paired, play a ranked game, and see their new ratings', async () => {
    const [a, b] = [await guest('Quick A'), await guest('Quick B')];
    const [sa, sb] = [await open(a.token), await open(b.token)];
    const matchedA = next(sa, 'queue:matched');
    const matchedB = next(sb, 'queue:matched');
    await ok(sa, 'queue:join', { gameId: 'four-in-a-row', timeControl: 'rapid', ranked: true });
    await ok(sb, 'queue:join', { gameId: 'four-in-a-row', timeControl: 'rapid', ranked: true });
    const [ma, mb] = [await matchedA, await matchedB];
    expect(ma.roomCode).toBe(mb.roomCode);

    // The game is already running; it is listed for spectators.
    const live = await api<{ rooms: LiveRoom[] }>('GET', '/api/live');
    expect(live.body.rooms.find((r) => r.code === ma.roomCode)).toMatchObject({
      gameId: 'four-in-a-row',
      ranked: true,
    });

    const ja = await ok<{ room: RoomSnapshot; match: MatchSnapshot }>(sa, 'room:join', { code: ma.roomCode });
    const jb = await ok<{ room: RoomSnapshot; match: MatchSnapshot }>(sb, 'room:join', { code: mb.roomCode });
    expect(ja.room).toMatchObject({ status: 'playing', ranked: true, public: true });
    const players = { [ja.match.mySeat!]: sa, [jb.match.mySeat!]: sb };

    // Seat 0 stacks column 0, seat 1 column 1: seat 0 wins.
    let seq = 0;
    let last: MatchSnapshot | undefined;
    for (let i = 0; i < 7; i++) {
      const expected = seq + 1;
      const update = next(sa, 'match:state', (m) => m.seq === expected);
      seq = (
        await ok<{ seq: number }>(players[i % 2]!, 'move:submit', {
          matchId: ja.match.matchId,
          seq,
          clientMoveId: `quick-${i}-${ja.match.matchId}`,
          move: { col: i % 2 },
        })
      ).seq;
      last = await update;
    }
    expect(last?.result).toMatchObject({ kind: 'win', winners: [0] });
    expect(last?.ratingChanges).toHaveLength(2);
    expect(last!.ratingChanges![0]!.after).toBeGreaterThan(last!.ratingChanges![0]!.before);

    const winner = ja.match.mySeat === 0 ? a : b;
    const mine = await api<{ ratings: UserRating[] }>('GET', '/api/me/ratings', undefined, winner.token);
    expect(mine.body.ratings).toEqual([
      expect.objectContaining({ gameId: 'four-in-a-row', games: 1, wins: 1, provisional: true }),
    ]);
    // Leaderboard needs 5 games; and the finished game left the live list.
    const board = await api<{ entries: unknown[]; minGames: number }>(
      'GET',
      '/api/leaderboard/four-in-a-row',
    );
    expect(board.body).toMatchObject({ minGames: 5, entries: [] });
    expect((await api('GET', '/api/leaderboard/nope')).status).toBe(400);
    const after = await api<{ rooms: LiveRoom[] }>('GET', '/api/live');
    expect(after.body.rooms.find((r) => r.code === ma.roomCode)).toBeUndefined();
  });

  it('leaving the queue, or disconnecting, takes you out of it', async () => {
    const [a, b] = [await guest('Leaver'), await guest('Stayer')];
    const sa = await open(a.token);
    await ok(sa, 'queue:join', { gameId: 'caro', timeControl: 'blitz', ranked: false });
    await ok(sa, 'queue:leave', {});
    let sb = await open(b.token);
    await ok(sb, 'queue:join', { gameId: 'caro', timeControl: 'blitz', ranked: false });
    sb.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    expect(await server.hub['o'].store.queueBuckets()).toEqual([]);
    sb = await open(b.token);
    expect(await emit(sb, 'queue:join', { gameId: 'caro', timeControl: 'none', ranked: false })).toEqual({
      ok: false,
      code: 'invalid.payload',
    });
  });
});
