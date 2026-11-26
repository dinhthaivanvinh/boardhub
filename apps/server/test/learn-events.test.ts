import { describe, expect, it } from 'vitest';
import type { AuthResponse } from '@bg/protocol';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';
import { KEEP_LEARN_DAYS, LearnEventService, MemoryLearnEventRepo } from '../src/stats/learn-events';
import { dayOf } from '../src/stats/visit-service';
import { MemoryUserRepo } from '../src/store/repos';

const DAY = 86_400_000;
const at = Date.UTC(2026, 10, 25, 3, 0);
const visitorId = 'v'.repeat(20);

describe('learning events (service)', () => {
  it('keeps one event per child, day and item', async () => {
    let now = at;
    const repo = new MemoryLearnEventRepo();
    const svc = new LearnEventService(repo, () => now);
    const child = { userId: null, visitorId };
    await svc.record(child, 'lesson', 'pawn');
    await svc.record(child, 'lesson', 'pawn');
    await svc.record(child, 'practice', 'practice-pawn');
    await svc.record(child, 'puzzle', 't1-01');
    expect((await repo.listDay(dayOf(at))).map((e) => e.itemId)).toEqual(['pawn', 'practice-pawn', 't1-01']);
    now = at + DAY;
    await svc.record(child, 'lesson', 'pawn'); // again on another day: activity of that day
    expect(await repo.listDay(dayOf(now))).toHaveLength(1);
  });

  it('refuses ids that do not exist, whatever their kind', async () => {
    const svc = new LearnEventService(new MemoryLearnEventRepo(), () => at);
    const child = { userId: null, visitorId };
    await expect(svc.record(child, 'lesson', 'made-up')).rejects.toThrow('invalid.payload');
    await expect(svc.record(child, 'puzzle', 'pawn')).rejects.toThrow('invalid.payload');
  });

  it('forgets old days', async () => {
    let now = at;
    const repo = new MemoryLearnEventRepo();
    const svc = new LearnEventService(repo, () => now);
    await svc.record({ userId: null, visitorId }, 'lesson', 'pawn');
    now = at + (KEEP_LEARN_DAYS + 1) * DAY;
    await svc.record({ userId: null, visitorId }, 'lesson', 'rook');
    expect(await repo.listDay(dayOf(at))).toEqual([]);
  });
});

describe('learning events (HTTP)', () => {
  it('stores the account when signed in, else the browser id, and never both', async () => {
    const learnRepo = new MemoryLearnEventRepo();
    const users = new MemoryUserRepo();
    const server = await buildServer(loadConfig({ LOG_LEVEL: 'silent', BOT_WORKERS: '0' }), {
      learnRepo,
      users,
    });
    const post = (url: string, payload: object, token?: string) =>
      server.app.inject({
        method: 'POST',
        url,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
    const event = { visitorId, kind: 'lesson', itemId: 'pawn' };
    expect((await post('/api/learn-events', event)).statusCode).toBe(200);
    expect((await post('/api/learn-events', { ...event, name: 'Bé' })).statusCode).toBe(400);
    const guest = (await post('/api/auth/guest', { displayName: 'Bé' })).json<AuthResponse>();
    expect((await post('/api/learn-events', event, guest.token)).statusCode).toBe(200);

    const stored = await learnRepo.listDay(dayOf(Date.now()));
    expect(stored.map((e) => [e.actor, e.userId])).toEqual([
      [`v:${visitorId}`, null],
      [`u:${guest.user.id}`, guest.user.id],
    ]);
    // using the account marks when it was last active
    expect(users.lastSeen.get(guest.user.id)).toBeGreaterThan(0);
    await server.close();
  });
});
