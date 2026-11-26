import { describe, expect, it } from 'vitest';
import { vnDayStart, type AdminOverview, type AdminStats, type AuthResponse, vnDay } from '@bg/protocol';
import { MemoryAdminRepo } from '../src/admin/admin-repo';
import { MemoryAnalyticsRepo } from '../src/analytics/analytics-repo';
import { AnalyticsService } from '../src/analytics/analytics-service';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';
import { LearnEventService, MemoryLearnEventRepo } from '../src/stats/learn-events';
import { MemoryVisitRepo } from '../src/stats/visit-repo';
import { VisitService } from '../src/stats/visit-service';
import { MemoryHistoryRepo, MemoryUserRepo } from '../src/store/repos';

const HOUR = 3_600_000;
/** An hour of a Vietnam day. */
const on = (day: string, hour = 12) => vnDayStart(day) + hour * HOUR;

function world() {
  const users = new MemoryUserRepo();
  const history = new MemoryHistoryRepo();
  const learn = new MemoryLearnEventRepo();
  const admin = new MemoryAdminRepo();
  const service = new AnalyticsService(new MemoryAnalyticsRepo(users, history, learn, admin), users);
  let n = 0;
  const account = (kind: 'guest' | 'registered', at: number, name = `U${++n}`) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    users.users.set(id, { id, kind, displayName: name, email: null, passwordHash: null, createdAt: at });
    return id;
  };
  const game = (gameId: string, at: number, player: string) =>
    history.createMatch({
      id: `m${++n}`,
      roomCode: 'ABC123',
      gameId,
      rulesVersion: 1,
      config: {},
      timeControl: { type: 'none' },
      seed: 's',
      startedAt: at,
      ranked: false,
      players: [
        { seat: 0, userId: player, botLevel: null },
        { seat: 1, userId: null, botLevel: 'easy' },
      ],
    });
  let now = 0;
  const events = new LearnEventService(learn, () => now);
  const finish = async (
    at: number,
    visitorId: string,
    kind: 'lesson' | 'practice' | 'puzzle',
    itemId: string,
    userId: string | null = null,
  ) => {
    now = at;
    await events.record({ userId, visitorId: visitorId.repeat(20) }, kind, itemId);
  };
  return { users, service, account, game, finish };
}

const range = { from: '2026-11-10', to: '2026-11-12' };

describe('admin dashboard numbers', () => {
  it('counts accounts at the end of the range and the ones made in it, by Vietnam days', async () => {
    const { service, account } = world();
    account('registered', on('2026-11-01'));
    account('guest', on('2026-11-08')); // the range before
    account('guest', on('2026-11-10', 0)); // the first moment of the range
    account('registered', on('2026-11-12', 23));
    account('guest', on('2026-11-13', 0)); // after the range
    const o = await service.overview(range);
    expect(o.accounts.all).toEqual({ total: 4, added: { value: 2, previous: 1 } });
    expect(o.accounts.registered).toEqual({ total: 2, added: { value: 1, previous: 0 } });
    expect(o.accounts.guest).toEqual({ total: 2, added: { value: 1, previous: 1 } });
    expect(o.days.map((d) => [d.day, d.registered, d.guest])).toEqual([
      ['2026-11-10', 1, 2],
      ['2026-11-11', 1, 2],
      ['2026-11-12', 2, 2],
    ]);
  });

  it('counts only chess games, up to the end of the range', async () => {
    const { service, account, game } = world();
    const p = account('guest', on('2026-11-01'));
    await game('chess', on('2026-11-02'), p);
    await game('chess', on('2026-11-09'), p);
    await game('chess', on('2026-11-11'), p);
    await game('caro', on('2026-11-11'), p);
    await game('chess', on('2026-11-14'), p);
    const o = await service.overview(range);
    expect(o.chess).toEqual({ total: 3, started: { value: 1, previous: 1 } });
    expect(o.days.map((d) => d.chessGames)).toEqual([0, 1, 0]);
  });

  it('shows learning as unknown before it was recorded, and compares only complete ranges', async () => {
    const { service, finish } = world();
    expect((await service.overview(range)).days.every((d) => d.learners === null)).toBe(true);

    await finish(on('2026-11-11'), 'a', 'lesson', 'pawn');
    await finish(on('2026-11-11'), 'a', 'puzzle', 't1-01');
    await finish(on('2026-11-12'), 'a', 'lesson', 'pawn'); // again: one finished lesson, one more active day
    await finish(on('2026-11-12'), 'b', 'lesson', 'pawn');
    await finish(on('2026-11-12'), 'b', 'practice', 'practice-pawn');
    const o = await service.overview(range);
    expect(o.learningSince).toBe('2026-11-11');
    expect(o.learners).toEqual({ value: 2, previous: null });
    expect(o.completedLessons).toMatchObject({ value: 2, previous: null });
    expect(o.solvedPuzzles).toMatchObject({ value: 1, previous: null });
    expect(o.lessons).toEqual([{ itemId: 'pawn', learners: 2 }]);
    expect(o.days.map((d) => [d.learners, d.lesson, d.practice, d.puzzle])).toEqual([
      [null, null, null, null],
      [1, 1, 0, 1],
      [2, 2, 1, 0],
    ]);

    // A later range whose previous one lies fully after the first recorded day can be compared.
    const later = await service.overview({ from: '2026-11-13', to: '2026-11-14' });
    expect(later.learners).toEqual({ value: 0, previous: 2 });
  });

  it('counts saved progress from the accounts, only for lessons and puzzles that exist', async () => {
    const { users, service, account } = world();
    const id = account('registered', on('2026-11-01'));
    await users.setLearnProgress(id, {
      lessons: ['pawn', 'rook', 'practice-pawn', 'gone'],
      puzzles: ['t1-01', 'nope'],
      days: [],
      daily: [],
    });
    const o = await service.overview(range);
    expect(o.completedLessons.saved).toBe(2);
    expect(o.solvedPuzzles.saved).toBe(1);
    expect(o.lessonsTotal).toBeGreaterThan(10);
  });

  it('lists what happened last, with names, newest first', async () => {
    const { service, account, game, finish } = world();
    const an = account('registered', on('2026-11-10'), 'An');
    await game('chess', on('2026-11-11'), an);
    await finish(on('2026-11-12'), 'z', 'lesson', 'pawn');
    expect((await service.overview(range)).recent).toEqual([
      { type: 'learn', at: on('2026-11-12'), kind: 'lesson', itemId: 'pawn', name: null },
      { type: 'match', at: on('2026-11-11'), gameId: 'chess', players: ['An', null] },
      { type: 'signup', at: on('2026-11-10'), kind: 'registered', name: 'An' },
    ]);
  });
});

describe('visitor numbers over a range', () => {
  it('counts a visitor once over all the days, as the highest kind, and compares with the range before', async () => {
    let now = on('2026-11-08');
    const svc = new VisitService(new MemoryVisitRepo(), () => now);
    await svc.record('a'.repeat(16), 'anonymous');
    now = on('2026-11-10');
    await svc.record('a'.repeat(16), 'anonymous');
    await svc.record('b'.repeat(16), 'guest');
    now = on('2026-11-11');
    await svc.record('a'.repeat(16), 'registered');
    await svc.record('a'.repeat(16), 'registered', true);
    now = on('2026-11-12');
    const s = await svc.stats({ from: '2026-11-10', to: '2026-11-12' });
    // three daily rows, two people
    expect(s.unique).toEqual({ total: 2, anonymous: 0, guest: 1, registered: 1, sessions: 4 });
    // the range before starts before the first stored day
    expect(s.previous).toBeNull();
    expect(s.since).toBe('2026-11-08');
    expect((await svc.stats({ from: '2026-11-10', to: '2026-11-11' })).previous).toMatchObject({ total: 1 });
    expect(s.days.map((d) => d.day)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
  });
});

describe('admin dashboard (HTTP)', () => {
  it('takes a good range from an admin and refuses the others', async () => {
    const server = await buildServer(
      loadConfig({
        LOG_LEVEL: 'silent',
        BOT_WORKERS: '0',
        ADMIN_EMAILS: 'boss@example.com',
        ADMIN_SELF_REGISTER: 'true',
      }),
    );
    const call = async <T>(url: string, token?: string) => {
      const res = await server.app.inject({
        method: 'GET',
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      return { status: res.statusCode, body: res.json() as T };
    };
    const register = await server.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'boss@example.com', password: 'secret-123', displayName: 'Boss' },
    });
    const { token } = register.json<AuthResponse>();
    const today = vnDay(Date.now());

    const ok = await call<AdminOverview>(`/api/admin/overview?from=${today}&to=${today}`, token);
    expect(ok.status).toBe(200);
    expect(ok.body.accounts.registered.total).toBe(1);
    expect(ok.body.recent[0]).toMatchObject({ type: 'signup', name: 'Boss' });
    expect(
      (await call<AdminStats>(`/api/admin/stats?from=${today}&to=${today}`, token)).body.days,
    ).toHaveLength(1);
    expect((await call<AdminStats>('/api/admin/stats?days=14', token)).body.days).toHaveLength(14);

    for (const bad of [
      '',
      `?from=${today}`,
      `?from=${today}&to=2000-01-01`,
      '?from=2026-02-31&to=2026-03-01',
      '?from=2020-01-01&to=2020-12-31',
      '?from=2099-01-01&to=2099-01-02',
      '?from=yesterday&to=today',
    ]) {
      const res = await call(`/api/admin/overview${bad}`, token);
      expect([bad, res.status]).toEqual([bad, 400]);
    }
    expect((await call('/api/admin/overview')).status).toBe(401);
    await server.close();
  });
});
