import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { LearnKind, ReportReason } from '@bg/protocol';
import {
  noCounts,
  type AccountKind,
  type AnalyticsRepo,
  type RawActivity,
} from '../analytics/analytics-repo';
import type { Database } from './database';

/** The Vietnam day (fixed +7 hours) of a timestamptz column, as `YYYY-MM-DD`. */
const vnDayOf = (column: string): RawBuilder<string> =>
  sql<string>`to_char((${sql.ref(column)} at time zone 'UTC') + interval '7 hours', 'YYYY-MM-DD')`;

const count = sql<string>`count(*)`;

export class PgAnalyticsRepo implements AnalyticsRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async accountsBefore(at: number) {
    const rows = await this.db
      .selectFrom('users')
      .select(['kind', count.as('n')])
      .where('created_at', '<', new Date(at))
      .groupBy('kind')
      .execute();
    const out = noCounts();
    for (const r of rows) out[r.kind] = Number(r.n);
    return out;
  }

  async newAccounts(from: number, to: number) {
    const day = vnDayOf('created_at');
    const rows = await this.db
      .selectFrom('users')
      .select([day.as('day'), 'kind', count.as('n')])
      .where('created_at', '>=', new Date(from))
      .where('created_at', '<', new Date(to))
      .groupBy([sql`1`, 'kind'])
      .execute();
    return rows.map((r) => ({ day: r.day, kind: r.kind as AccountKind, n: Number(r.n) }));
  }

  async matchesBefore(gameId: string, at: number) {
    const row = await this.db
      .selectFrom('matches')
      .select(count.as('n'))
      .where('game_id', '=', gameId)
      .where('started_at', '<', new Date(at))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async matchesByDay(gameId: string, from: number, to: number) {
    const rows = await this.db
      .selectFrom('matches')
      .select([vnDayOf('started_at').as('day'), count.as('n')])
      .where('game_id', '=', gameId)
      .where('started_at', '>=', new Date(from))
      .where('started_at', '<', new Date(to))
      .groupBy(sql`1`)
      .execute();
    return rows.map((r) => ({ day: r.day, n: Number(r.n) }));
  }

  async learnByDay(from: string, to: string) {
    const of = (kind: LearnKind) => sql<string>`count(*) filter (where kind = ${kind})`;
    const rows = await this.db
      .selectFrom('learn_events')
      .select([
        'day',
        sql<string>`count(distinct actor)`.as('learners'),
        of('lesson').as('lesson'),
        of('practice').as('practice'),
        of('puzzle').as('puzzle'),
      ])
      .where('day', '>=', from)
      .where('day', '<=', to)
      .groupBy('day')
      .execute();
    return rows.map((r) => ({
      day: r.day,
      learners: Number(r.learners),
      lesson: Number(r.lesson),
      practice: Number(r.practice),
      puzzle: Number(r.puzzle),
    }));
  }

  async learnTotals(from: string, to: string) {
    const of = (kind: LearnKind) =>
      sql<string>`count(distinct (actor, item_id)) filter (where kind = ${kind})`;
    const row = await this.db
      .selectFrom('learn_events')
      .select([
        sql<string>`count(distinct actor)`.as('learners'),
        of('lesson').as('lesson'),
        of('practice').as('practice'),
        of('puzzle').as('puzzle'),
      ])
      .where('day', '>=', from)
      .where('day', '<=', to)
      .executeTakeFirstOrThrow();
    return {
      learners: Number(row.learners),
      lesson: Number(row.lesson),
      practice: Number(row.practice),
      puzzle: Number(row.puzzle),
    };
  }

  async lessonLearners(from: string, to: string) {
    const rows = await this.db
      .selectFrom('learn_events')
      .select(['item_id', sql<string>`count(distinct actor)`.as('learners')])
      .where('kind', '=', 'lesson')
      .where('day', '>=', from)
      .where('day', '<=', to)
      .groupBy('item_id')
      .execute();
    return rows.map((r) => ({ itemId: r.item_id, learners: Number(r.learners) }));
  }

  async learningSince() {
    const row = await this.db
      .selectFrom('learn_events')
      .select(sql<string | null>`min(day)`.as('day'))
      .executeTakeFirstOrThrow();
    return row.day;
  }

  async savedProgress(lessonIds: string[], puzzleIds: string[]) {
    const saved = (key: 'lessons' | 'puzzles', ids: string[]) =>
      sql<string>`(select count(*) from users,
        jsonb_array_elements_text(coalesce(learn_progress -> ${sql.lit(key)}, '[]'::jsonb)) as item
        where item = any(${ids}::text[]))`;
    const res = await sql<{ lessons: string; puzzles: string }>`
      select ${saved('lessons', lessonIds)} as lessons, ${saved('puzzles', puzzleIds)} as puzzles
    `.execute(this.db);
    return { lessons: Number(res.rows[0]!.lessons), puzzles: Number(res.rows[0]!.puzzles) };
  }

  async recent(limit: number) {
    const [users, matches, reports, events] = await Promise.all([
      this.db
        .selectFrom('users')
        .select(['id', 'kind', 'created_at'])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute(),
      this.db
        .selectFrom('matches')
        .select(['id', 'game_id', 'started_at'])
        .orderBy('started_at', 'desc')
        .limit(limit)
        .execute(),
      this.db
        .selectFrom('player_reports')
        .select(['target_id', 'reason', 'created_at'])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute(),
      this.db
        .selectFrom('learn_events')
        .select(['user_id', 'kind', 'item_id', 'created_at'])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute(),
    ]);
    const seats = matches.length
      ? await this.db
          .selectFrom('match_players')
          .select(['match_id', 'user_id'])
          .where(
            'match_id',
            'in',
            matches.map((m) => m.id),
          )
          .orderBy('seat')
          .execute()
      : [];
    const all: RawActivity[] = [
      ...users.map((u) => ({
        type: 'signup' as const,
        at: u.created_at.getTime(),
        userId: u.id,
        kind: u.kind,
      })),
      ...matches.map((m) => ({
        type: 'match' as const,
        at: m.started_at.getTime(),
        gameId: m.game_id,
        players: seats.filter((s) => s.match_id === m.id).map((s) => s.user_id),
      })),
      ...reports.map((r) => ({
        type: 'report' as const,
        at: r.created_at.getTime(),
        targetId: r.target_id,
        reason: r.reason as ReportReason,
      })),
      ...events.map((e) => ({
        type: 'learn' as const,
        at: e.created_at.getTime(),
        userId: e.user_id,
        kind: e.kind,
        itemId: e.item_id,
      })),
    ];
    return all.sort((a, b) => b.at - a.at).slice(0, limit);
  }
}
