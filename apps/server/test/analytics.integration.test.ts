import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vnDayStart } from '@bg/protocol';
import { createDb, migrateToLatest } from '../src/db/database';
import { PgAnalyticsRepo } from '../src/db/pg-analytics-repo';
import { PgLearnEventRepo } from '../src/db/pg-learn-repo';
import { PgHistoryRepo, PgUserRepo } from '../src/db/pg-repos';
import { PgVisitRepo } from '../src/db/pg-visit-repo';

// The dashboard's SQL against a real Postgres. Everything is dated in 1995, so no other test's rows count.
const db = createDb(process.env.DATABASE_URL!);
const repo = new PgAnalyticsRepo(db);
const ids = [randomUUID(), randomUUID(), randomUUID()] as const;
const matchId = randomUUID();
const on = (day: string, hour = 12) => vnDayStart(day) + hour * 3_600_000;

async function clean() {
  await db.deleteFrom('matches').where('id', '=', matchId).execute();
  await db.deleteFrom('learn_events').where('day', 'like', '1995-%').execute();
  await db.deleteFrom('daily_visits').where('day', 'like', '1995-%').execute();
  await db.deleteFrom('account_visits').where('day', 'like', '1995-%').execute();
  await db
    .deleteFrom('users')
    .where('id', 'in', [...ids])
    .execute();
}

beforeAll(async () => {
  await migrateToLatest(db);
  await clean();
});
afterAll(async () => {
  await clean();
  await db.destroy();
});

describe('dashboard queries in Postgres', () => {
  it('groups accounts and matches by Vietnam day', async () => {
    const start = vnDayStart('1995-03-10');
    const end = vnDayStart('1995-03-12');
    const before = await repo.accountsBefore(start);
    const account = (id: string, kind: 'guest' | 'registered', at: number) =>
      db
        .insertInto('users')
        .values({
          id,
          kind,
          display_name: 'A',
          email: null,
          password_hash: null,
          created_at: new Date(at),
        })
        .execute();
    await account(ids[0], 'guest', on('1995-03-09'));
    await account(ids[1], 'guest', start); // 17:00 UTC the day before is already the 10th in Vietnam
    await account(ids[2], 'registered', on('1995-03-11', 23));
    expect((await repo.accountsBefore(start)).guest).toBe(before.guest + 1);
    const added = await repo.newAccounts(start, end);
    expect(added.sort((a, b) => a.day.localeCompare(b.day))).toEqual([
      { day: '1995-03-10', kind: 'guest', n: 1 },
      { day: '1995-03-11', kind: 'registered', n: 1 },
    ]);

    const games = await repo.matchesBefore('chess', start);
    await new PgHistoryRepo(db).createMatch({
      id: matchId,
      roomCode: 'ABC123',
      gameId: 'chess',
      rulesVersion: 1,
      config: {},
      timeControl: { type: 'none' },
      seed: 's',
      startedAt: on('1995-03-11', 1),
      ranked: false,
      players: [
        { seat: 0, userId: ids[2], botLevel: null },
        { seat: 1, userId: null, botLevel: 'easy' },
      ],
    });
    expect(await repo.matchesByDay('chess', start, end)).toEqual([{ day: '1995-03-11', n: 1 }]);
    expect(await repo.matchesBefore('chess', end)).toBe(games + 1);
  });

  it('counts learners and finished items', async () => {
    const events = new PgLearnEventRepo(db);
    const add = (day: string, actor: string, kind: 'lesson' | 'practice' | 'puzzle', itemId: string) =>
      events.record({ day, actor, userId: null, kind, itemId, at: on(day) });
    await add('1995-03-11', 'v:a', 'lesson', 'pawn');
    await add('1995-03-11', 'v:a', 'puzzle', 't1-01');
    await add('1995-03-12', 'v:a', 'lesson', 'pawn');
    await add('1995-03-12', 'v:b', 'lesson', 'pawn');
    await add('1995-03-12', 'v:b', 'practice', 'practice-pawn');
    expect(await repo.learningSince()).toBe('1995-03-11');
    expect(await repo.learnTotals('1995-03-11', '1995-03-12')).toEqual({
      learners: 2,
      lesson: 2,
      practice: 1,
      puzzle: 1,
    });
    expect(
      (await repo.learnByDay('1995-03-11', '1995-03-12')).sort((a, b) => a.day.localeCompare(b.day)),
    ).toEqual([
      { day: '1995-03-11', learners: 1, lesson: 1, practice: 0, puzzle: 1 },
      { day: '1995-03-12', learners: 2, lesson: 2, practice: 1, puzzle: 0 },
    ]);
    expect(await repo.lessonLearners('1995-03-11', '1995-03-12')).toEqual([{ itemId: 'pawn', learners: 2 }]);
  });

  it('counts saved progress for the given ids only', async () => {
    const before = await repo.savedProgress(['pawn', 'rook'], ['t1-01']);
    await new PgUserRepo(db).setLearnProgress(ids[2], {
      lessons: ['pawn', 'rook', 'practice-pawn'],
      puzzles: ['t1-01', 'nope'],
      days: [],
      daily: [],
    });
    expect(await repo.savedProgress(['pawn', 'rook'], ['t1-01'])).toEqual({
      lessons: before.lessons + 2,
      puzzles: before.puzzles + 1,
    });
  });

  it('lists the latest things, newest first, with the seats of a match', async () => {
    const recent = await repo.recent(1000);
    expect(recent.map((r) => r.at)).toEqual(recent.map((r) => r.at).sort((a, b) => b - a));
    const match = recent.find((r) => r.type === 'match' && r.at === on('1995-03-11', 1));
    // Only checked when the shared database is small enough for 1995 to be among the latest.
    if (match) expect(match).toMatchObject({ players: [ids[2], null] });
  });

  it('lists the accounts that visited, once each, latest visit first', async () => {
    const visits = new PgVisitRepo(db);
    // the accounts made by the first test
    await visits.recordAccount('1995-04-01', ids[0]);
    await visits.recordAccount('1995-04-02', ids[2]);
    await visits.recordAccount('1995-04-03', ids[2]);
    await visits.recordAccount('1995-04-03', ids[2]);
    expect(await visits.accounts('1995-04-01', '1995-04-03', 10)).toEqual([
      { userId: ids[2], days: 2, lastDay: '1995-04-03' },
      { userId: ids[0], days: 1, lastDay: '1995-04-01' },
    ]);
    expect(await visits.accounts('1995-04-01', '1995-04-03', 1)).toHaveLength(1);
    expect(await visits.accountsSince()).toBe('1995-04-01');
  });

  it('counts a visitor once over a range, as the highest kind, with all sessions', async () => {
    const visits = new PgVisitRepo(db);
    await visits.record('1995-03-10', 'a'.repeat(16), 'anonymous');
    await visits.record('1995-03-11', 'a'.repeat(16), 'registered');
    await visits.record('1995-03-11', 'a'.repeat(16), 'registered', true);
    await visits.record('1995-03-11', 'b'.repeat(16), 'guest');
    expect(await visits.totals('1995-03-10', '1995-03-11')).toEqual({
      total: 2,
      anonymous: 0,
      guest: 1,
      registered: 1,
      sessions: 4,
    });
    expect(await visits.since()).toBe('1995-03-10');
  });
});
