import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  SANCTION_FOREVER,
  type Ack,
  type AdminGameSetting,
  type AdminReport,
  type AuthResponse,
  type ChatMessage,
  type ClientToServerEvents,
  type GamesStatus,
  type MatchSnapshot,
  type PublicUser,
  type RoomSnapshot,
  type SanctionedUser,
  type ServerToClientEvents,
} from '@bg/protocol';
import { MemoryAdminRepo } from '../src/admin/admin-repo';
import { AdminService, REPORTS_PER_HOUR } from '../src/admin/admin-service';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';
import { MemoryUserRepo } from '../src/store/repos';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: Awaited<ReturnType<typeof buildServer>>;
let url: string;
const sockets: Client[] = [];

beforeAll(async () => {
  server = await buildServer(
    loadConfig({
      LOG_LEVEL: 'silent',
      BOT_WORKERS: '0',
      BOT_DELAY_MS: '0',
      ADMIN_EMAILS: 'Boss@Example.com, other@example.com',
      ADMIN_SELF_REGISTER: 'true',
    }),
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

async function api<T>(method: string, path: string, body?: unknown, token?: string) {
  const res = await server.app.inject({
    method: method as 'GET',
    url: path,
    ...(body !== undefined && { payload: body as object }),
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: res.json() as T };
}

const guest = async (name: string) =>
  (await api<AuthResponse>('POST', '/api/auth/guest', { displayName: name })).body;

let emails = 0;
async function registered(name: string, email = `p${++emails}@example.com`) {
  return (
    await api<AuthResponse>('POST', '/api/auth/register', {
      email,
      password: 'secret-123',
      displayName: name,
    })
  ).body;
}

function open(token: string): Promise<Client> {
  const socket: Client = connect(url, {
    auth: { token, protocolVersion: PROTOCOL_VERSION },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const emit = <R>(socket: Client, event: keyof ClientToServerEvents, payload: unknown) =>
  new Promise<Ack<R>>((resolve) =>
    (socket.emit as (e: string, p: unknown, ack: (r: Ack<R>) => void) => void)(event, payload, resolve),
  );

async function ok<R>(socket: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<R> {
  const res = await emit<R>(socket, event, payload);
  if (!res.ok) throw new Error(`${event} failed: ${res.code}`);
  return res.data;
}

const lobby = { gameId: 'caro', timeControl: { type: 'none' }, disconnectPolicy: 'forfeit', hostSeat: 0 };

/** Two players in one room; `target` has said something in the chat. */
async function roomWithChat(line: string) {
  const reporter = await guest('Reporter');
  const target = await guest('Target');
  const a = await open(reporter.token);
  const b = await open(target.token);
  const { room } = await ok<{ room: RoomSnapshot }>(a, 'room:create', lobby);
  await ok(b, 'room:join', { code: room.code });
  const heard = new Promise<ChatMessage>((resolve) => a.once('chat:message', resolve));
  await ok(b, 'chat:send', { roomId: room.id, text: line });
  await heard;
  return { reporter, target, a, b, room };
}

describe('admin access', () => {
  // A permission check that is not awaited would let the request through: every route is tried.
  it('refuses a signed-in player on every admin route', async () => {
    const player = await registered('Curious');
    const id = '00000000-0000-4000-8000-0000000000aa';
    const routes: [string, string, unknown?][] = [
      ['GET', '/api/admin/games'],
      ['PUT', '/api/admin/games/caro', { enabled: false }],
      ['GET', '/api/admin/reports'],
      ['POST', `/api/admin/reports/${id}/resolve`, { action: 'dismiss' }],
      ['GET', '/api/admin/sanctions'],
      ['PUT', `/api/admin/users/${id}/sanctions`, { mutedUntil: null }],
      ['GET', '/api/admin/stats'],
      ['GET', '/api/admin/overview?from=2026-11-01&to=2026-11-02'],
    ];
    for (const [method, path, body] of routes) {
      const res = await api(method, path, body, player.token);
      expect([method, path, res.status, res.body]).toEqual([method, path, 403, { code: 'admin.required' }]);
    }
    expect((await api<GamesStatus>('GET', '/api/games/status')).body.disabled).not.toContain('caro');
  });

  it('only super admins may use /api/admin', async () => {
    expect((await api('GET', '/api/admin/games')).status).toBe(401);
    const g = await guest('Nobody');
    expect((await api('GET', '/api/admin/games', undefined, g.token)).status).toBe(403);
    const plain = await registered('Plain');
    expect(plain.user.admin).toBe(false);
    expect((await api('GET', '/api/admin/reports', undefined, plain.token)).body).toEqual({
      code: 'admin.required',
    });

    const boss = await registered('Boss', 'boss@example.com');
    expect(boss.user.admin).toBe(true);
    expect((await api<PublicUser>('GET', '/api/me', undefined, boss.token)).body.admin).toBe(true);
    const games = await api<{ games: AdminGameSetting[] }>('GET', '/api/admin/games', undefined, boss.token);
    expect(games.status).toBe(200);
    expect(games.body.games.map((g) => g.gameId)).toContain('caro');
    expect(games.body.games.every((g) => g.enabled)).toBe(true);
  });
});

describe('turning a game off (FR-CAT-03)', () => {
  it('blocks new rooms, starts and quick match, but not matches already playing', async () => {
    const boss = (
      await api<AuthResponse>('POST', '/api/auth/login', {
        email: 'boss@example.com',
        password: 'secret-123',
      })
    ).body;
    const host = await guest('Host');
    const friend = await guest('Friend');
    const h = await open(host.token);
    const f = await open(friend.token);

    // A lobby that exists before the switch, and a match that is already running.
    const { room: waiting } = await ok<{ room: RoomSnapshot }>(h, 'room:create', lobby);
    const { room: running } = await ok<{ room: RoomSnapshot }>(h, 'room:create', lobby);
    await ok(f, 'room:join', { code: running.code });
    await ok(f, 'room:take-seat', { roomId: running.id, seat: 1 });
    await ok(f, 'room:set-ready', { roomId: running.id, ready: true });
    await ok(h, 'room:start', { roomId: running.id });

    const off = await api<AdminGameSetting>('PUT', '/api/admin/games/caro', { enabled: false }, boss.token);
    expect(off.body).toMatchObject({ gameId: 'caro', enabled: false });
    expect((await api<GamesStatus>('GET', '/api/games/status')).body).toEqual({ disabled: ['caro'] });
    expect((await api('PUT', '/api/admin/games/nope', { enabled: false }, boss.token)).status).toBe(400);

    expect(await emit(h, 'room:create', lobby)).toMatchObject({ ok: false, code: 'game.disabled' });
    expect(
      await emit(h, 'queue:join', { gameId: 'caro', timeControl: 'blitz', ranked: false }),
    ).toMatchObject({ ok: false, code: 'game.disabled' });
    await ok(f, 'room:join', { code: waiting.code });
    await ok(f, 'room:take-seat', { roomId: waiting.id, seat: 1 });
    await ok(f, 'room:set-ready', { roomId: waiting.id, ready: true });
    expect(await emit(h, 'room:start', { roomId: waiting.id })).toMatchObject({
      ok: false,
      code: 'game.disabled',
    });
    // Other games are untouched.
    await ok(h, 'room:create', { ...lobby, gameId: 'reversi' });
    // The running match goes on.
    const live = await ok<{ room: RoomSnapshot; match: MatchSnapshot | null }>(h, 'room:join', {
      code: running.code,
    });
    expect(live.room.status).toBe('playing');
    expect(live.match?.result).toBeNull();

    await api('PUT', '/api/admin/games/caro', { enabled: true }, boss.token);
    expect((await api<GamesStatus>('GET', '/api/games/status')).body).toEqual({ disabled: [] });
    await ok(h, 'room:start', { roomId: waiting.id });
  });
});

describe('player reports (FR-ADM-02)', () => {
  it('keeps the target’s chat as evidence; refuses self and duplicate reports', async () => {
    const { reporter, target, room } = await roomWithChat('you are a cheater');
    const self = await api(
      'POST',
      '/api/reports',
      { targetUserId: reporter.user.id, reason: 'abuse' },
      reporter.token,
    );
    expect(self.body).toEqual({ code: 'report.self' });
    expect(
      (await api('POST', '/api/reports', { targetUserId: target.user.id, reason: 'abuse' })).status,
    ).toBe(401);
    expect(
      (await api('POST', '/api/reports', { targetUserId: target.user.id, reason: 'bad' }, reporter.token))
        .status,
    ).toBe(400);

    const made = await api<{ id: string }>(
      'POST',
      '/api/reports',
      { targetUserId: target.user.id, reason: 'abuse', note: 'rude in chat', roomCode: room.code },
      reporter.token,
    );
    expect(made.status).toBe(200);
    const again = await api(
      'POST',
      '/api/reports',
      { targetUserId: target.user.id, reason: 'spam' },
      reporter.token,
    );
    expect(again).toEqual({ status: 409, body: { code: 'report.duplicate' } });

    const boss = await registered('Other boss', 'other@example.com');
    const list = await api<{ reports: AdminReport[] }>('GET', '/api/admin/reports', undefined, boss.token);
    const report = list.body.reports.find((r) => r.id === made.body.id)!;
    expect(report).toMatchObject({
      reporter: { id: reporter.user.id, name: 'Reporter' },
      target: { id: target.user.id, name: 'Target', kind: 'guest' },
      reason: 'abuse',
      note: 'rude in chat',
      roomCode: room.code,
      status: 'open',
      openAgainstTarget: 1,
      sanctions: { mutedUntil: null, bannedUntil: null },
    });
    expect(report.evidence.map((e) => e.text)).toEqual(['you are a cheater']);
  });

  it('a mute stops chat until it is lifted', async () => {
    const { reporter, target, b, room } = await roomWithChat('spam spam spam');
    const { body } = await api<{ id: string }>(
      'POST',
      '/api/reports',
      { targetUserId: target.user.id, reason: 'spam', roomCode: room.code },
      reporter.token,
    );
    const boss = (
      await api<AuthResponse>('POST', '/api/auth/login', {
        email: 'other@example.com',
        password: 'secret-123',
      })
    ).body;
    const resolved = await api<{ report: AdminReport }>(
      'POST',
      `/api/admin/reports/${body.id}/resolve`,
      { action: 'mute', hours: 24 },
      boss.token,
    );
    expect(resolved.body.report).toMatchObject({ status: 'resolved', action: 'mute' });
    expect(resolved.body.report.sanctions.mutedUntil).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    // Handled once: a second admin cannot resolve it again.
    expect(
      (await api('POST', `/api/admin/reports/${body.id}/resolve`, { action: 'dismiss' }, boss.token)).status,
    ).toBe(404);

    expect(await emit(b, 'chat:send', { roomId: room.id, text: 'hello?' })).toMatchObject({
      ok: false,
      code: 'chat.muted',
    });
    const muted = await api<{ users: SanctionedUser[] }>(
      'GET',
      '/api/admin/sanctions',
      undefined,
      boss.token,
    );
    expect(muted.body.users.find((u) => u.id === target.user.id)).toMatchObject({ name: 'Target' });
    const resolvedList = await api<{ reports: AdminReport[] }>(
      'GET',
      '/api/admin/reports?status=resolved',
      undefined,
      boss.token,
    );
    expect(resolvedList.body.reports.some((r) => r.id === body.id)).toBe(true);

    await api('PUT', `/api/admin/users/${target.user.id}/sanctions`, { mutedUntil: null }, boss.token);
    await ok(b, 'chat:send', { roomId: room.id, text: 'sorry' });
  });

  it('a ban drops the connection and blocks the account everywhere', async () => {
    const reporter = await guest('Reporter 2');
    const target = await registered('Cheater', 'cheat@example.com');
    const socket = await open(target.token);
    const dropped = new Promise<string>((resolve) => socket.once('disconnect', resolve));
    const { body } = await api<{ id: string }>(
      'POST',
      '/api/reports',
      { targetUserId: target.user.id, reason: 'cheating' },
      reporter.token,
    );
    const boss = (
      await api<AuthResponse>('POST', '/api/auth/login', {
        email: 'other@example.com',
        password: 'secret-123',
      })
    ).body;
    const done = await api<{ report: AdminReport }>(
      'POST',
      `/api/admin/reports/${body.id}/resolve`,
      { action: 'ban', hours: null },
      boss.token,
    );
    expect(done.body.report.sanctions.bannedUntil).toBe(SANCTION_FOREVER);
    expect(await dropped).toBe('io server disconnect');

    expect(await api('GET', '/api/me', undefined, target.token)).toEqual({
      status: 403,
      body: { code: 'auth.banned' },
    });
    const login = await api('POST', '/api/auth/login', {
      email: 'cheat@example.com',
      password: 'secret-123',
    });
    expect(login).toEqual({ status: 403, body: { code: 'auth.banned' } });
    await expect(open(target.token)).rejects.toThrow('auth.banned');

    // Lifting the ban lets them back in.
    await api('PUT', `/api/admin/users/${target.user.id}/sanctions`, { bannedUntil: null }, boss.token);
    expect((await api('GET', '/api/me', undefined, target.token)).status).toBe(200);
  });

  it(`a player may file at most ${REPORTS_PER_HOUR} reports an hour`, async () => {
    const reporter = await guest('Busy');
    for (let i = 0; i < REPORTS_PER_HOUR; i++) {
      const t = await guest(`T${i}`);
      const res = await api(
        'POST',
        '/api/reports',
        { targetUserId: t.user.id, reason: 'other' },
        reporter.token,
      );
      expect(res.status).toBe(200);
    }
    const last = await guest('T last');
    expect(
      await api('POST', '/api/reports', { targetUserId: last.user.id, reason: 'other' }, reporter.token),
    ).toEqual({ status: 429, body: { code: 'report.too_many' } });
  });
});

describe('AdminService', () => {
  async function setup() {
    let now = 1_000_000;
    const users = new MemoryUserRepo();
    const mk = (id: string, email: string | null) =>
      users.create({
        id,
        kind: email ? 'registered' : 'guest',
        displayName: id,
        email,
        passwordHash: null,
      });
    const admin = await mk('00000000-0000-4000-8000-000000000001', 'a@x.io');
    const p = await mk('00000000-0000-4000-8000-000000000002', null);
    const q = await mk('00000000-0000-4000-8000-000000000003', null);
    let ids = 0;
    const service = new AdminService({
      repo: new MemoryAdminRepo(),
      users,
      gameIds: ['caro'],
      adminEmails: ['A@x.io'],
      roomChat: async () => [],
      now: () => now,
      newId: () => `00000000-0000-4000-9000-${String(++ids).padStart(12, '0')}`,
    });
    expect(await service.bootstrapSuperAdmins()).toBe(1);
    return { service, admin, p, q, advance: (ms: number) => (now += ms), now: () => now };
  }

  it('sanctions end on time, and a shorter one never cuts a longer one short', async () => {
    const { service, admin, p, q, advance, now } = await setup();
    const r1 = await service.report(q, { targetUserId: p.id, reason: 'abuse', note: '' });
    await service.resolve(admin, r1.id, 'mute', 24 * 7);
    const week = now() + 24 * 7 * 3_600_000;
    const r2 = await service.report(admin, { targetUserId: p.id, reason: 'abuse', note: '' });
    await service.resolve(admin, r2.id, 'mute', 24);
    expect((await service.sanctionsOf(p.id)).mutedUntil).toBe(week);

    advance(24 * 7 * 3_600_000 + 1);
    expect(await service.isMuted(p.id)).toBe(false);
    expect(await service.sanctioned(admin)).toEqual([]);
  });

  it('admins cannot sanction themselves; non-admins cannot act at all', async () => {
    const { service, admin, p } = await setup();
    await expect(service.setSanctions(admin, admin.id, { bannedUntil: SANCTION_FOREVER })).rejects.toThrow(
      'report.self',
    );
    await expect(service.setGameEnabled(p, 'caro', false)).rejects.toThrow('admin.required');
    expect(await service.isAdmin(admin)).toBe(true);
  });
});

describe('first super admin', () => {
  const env = { LOG_LEVEL: 'silent', BOT_WORKERS: '0', ADMIN_EMAILS: 'boss@example.com, late@example.com' };
  const account = (users: MemoryUserRepo, id: string, email: string) =>
    users.create({ id, kind: 'registered', displayName: 'Boss', email, passwordHash: null });

  it('is the registered account on ADMIN_EMAILS, given at start-up', async () => {
    const users = new MemoryUserRepo();
    const boss = await account(users, '00000000-0000-4000-8000-000000000011', 'boss@example.com');
    const built = await buildServer(loadConfig(env), { users });
    expect(await built.admin.isAdmin(boss)).toBe(true);
    await built.close();
  });

  it('is not given again once somebody has the role: listing an address later grants nothing', async () => {
    const users = new MemoryUserRepo();
    const adminRepo = new MemoryAdminRepo();
    await adminRepo.grantRole('00000000-0000-4000-8000-000000000012', 'super_admin');
    const late = await account(users, '00000000-0000-4000-8000-000000000013', 'late@example.com');
    const built = await buildServer(loadConfig(env), { users, adminRepo });
    expect(await built.admin.isAdmin(late)).toBe(false);
    await built.close();
  });

  it('cannot be taken by signing up with a listed address', async () => {
    const built = await buildServer(loadConfig(env));
    const sign = (email: string) =>
      built.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password: 'secret-123', displayName: 'Stranger' },
      });
    const taken = await sign('Boss@Example.com');
    expect([taken.statusCode, taken.json()]).toEqual([409, { code: 'auth.email_taken' }]);
    const other = await sign('someone@example.com');
    expect(other.json<AuthResponse>().user.admin).toBe(false);
    await built.close();
  });

  it('never lets production hand out the role at sign-up', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        CORS_ORIGIN: 'https://example.com',
        ADMIN_SELF_REGISTER: 'true',
      }),
    ).toThrow('ADMIN_SELF_REGISTER');
  });
});
