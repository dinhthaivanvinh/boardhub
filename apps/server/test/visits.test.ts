import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminStats, AuthResponse } from '@bg/protocol';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';
import { MemoryVisitRepo } from '../src/stats/visit-repo';
import { dayOf, KEEP_DAYS, VisitService } from '../src/stats/visit-service';

describe('visit statistics (service)', () => {
  const DAY = 86_400_000;
  // 2026-11-25 23:30 in Vietnam is still the 25th, 17:00 UTC is already 00:00 on the 26th there.
  const at = Date.UTC(2026, 10, 25, 16, 30);

  it('counts the days by Vietnam time', () => {
    expect(dayOf(Date.UTC(2026, 10, 25, 16, 30))).toBe('2026-11-25');
    expect(dayOf(Date.UTC(2026, 10, 25, 17, 0))).toBe('2026-11-26');
  });

  it('counts a visitor once a day, as the highest kind they had', async () => {
    const svc = new VisitService(new MemoryVisitRepo(), () => at);
    await svc.record('a'.repeat(16), 'anonymous');
    await svc.record('a'.repeat(16), 'anonymous');
    await svc.record('b'.repeat(16), 'guest');
    await svc.record('c'.repeat(16), 'anonymous');
    await svc.record('c'.repeat(16), 'registered'); // signed in later the same day
    await svc.record('c'.repeat(16), 'anonymous'); // and a later ping without the token does not lower it
    const { today } = await svc.stats(7);
    expect(today).toEqual({ day: '2026-11-25', anonymous: 1, guest: 1, registered: 1, total: 3 });
  });

  it('lists the days before today newest first, with zeros, and forgets old days', async () => {
    let now = at - 2 * DAY;
    const repo = new MemoryVisitRepo();
    const svc = new VisitService(repo, () => now);
    await svc.record('a'.repeat(16), 'guest');
    now = at;
    await svc.record('b'.repeat(16), 'anonymous');
    const { days } = await svc.stats(3);
    expect(days.map((d) => [d.day, d.total])).toEqual([
      ['2026-11-25', 1],
      ['2026-11-24', 0],
      ['2026-11-23', 1],
    ]);
    now = at + (KEEP_DAYS + 5) * DAY;
    await svc.record('c'.repeat(16), 'guest');
    expect((await repo.counts(['2026-11-23']))[0]!.total).toBe(0);
  });
});

describe('visit statistics (HTTP)', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;
  beforeAll(async () => {
    server = await buildServer(
      loadConfig({
        LOG_LEVEL: 'silent',
        BOT_WORKERS: '0',
        ADMIN_EMAILS: 'boss@example.com',
        AUTH_RATE_LIMIT: '1000',
      }),
    );
  });
  afterAll(async () => server.close());

  const call = async <T>(method: 'GET' | 'POST', url: string, body?: object, token?: string) => {
    const res = await server.app.inject({
      method,
      url,
      ...(body && { payload: body }),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: res.statusCode, body: res.json() as T };
  };
  const id = (c: string) => c.repeat(20);

  it('takes a ping with or without a token, refuses a bad id, and shows the admin the numbers', async () => {
    expect((await call('POST', '/api/visit', { visitorId: id('a') })).status).toBe(200);
    expect((await call('POST', '/api/visit', { visitorId: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/visit', { visitorId: id('b') }, 'not-a-token')).status).toBe(200);
    const g = (await call<AuthResponse>('POST', '/api/auth/guest', { displayName: 'Bé' })).body;
    await call('POST', '/api/visit', { visitorId: id('c') }, g.token);
    const boss = (
      await call<AuthResponse>('POST', '/api/auth/register', {
        email: 'boss@example.com',
        password: 'secret-123',
        displayName: 'Boss',
      })
    ).body;
    await call('POST', '/api/visit', { visitorId: id('d') }, boss.token);

    const stats = await call<AdminStats>('GET', '/api/admin/stats?days=3', undefined, boss.token);
    expect(stats.status).toBe(200);
    expect(stats.body.days).toHaveLength(3);
    expect(stats.body.today).toMatchObject({ anonymous: 2, guest: 1, registered: 1, total: 4 });
  });

  it('keeps the numbers from everyone but admins', async () => {
    expect((await call('GET', '/api/admin/stats')).status).toBe(401);
    const g = (await call<AuthResponse>('POST', '/api/auth/guest', { displayName: 'Bé' })).body;
    expect((await call('GET', '/api/admin/stats', undefined, g.token)).status).toBe(403);
  });
});
