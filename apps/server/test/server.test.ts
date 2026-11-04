import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type Ack,
  type AuthResponse,
  type ClientToServerEvents,
  type MatchSnapshot,
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
