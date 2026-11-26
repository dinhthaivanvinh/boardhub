import { sql, type Kysely } from 'kysely';
import type { VisitorKind } from '@bg/protocol';
import { emptyDay, noVisitors, type VisitRepo } from '../stats/visit-repo';
import type { Database } from './database';

export class PgVisitRepo implements VisitRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async record(day: string, visitorId: string, kind: VisitorKind, newSession = false) {
    // A visitor that signs in later the same day is upgraded, never downgraded.
    const rank = sql<number>`case excluded.kind when 'registered' then 2 when 'guest' then 1 else 0 end`;
    const old = sql<number>`case daily_visits.kind when 'registered' then 2 when 'guest' then 1 else 0 end`;
    await this.db
      .insertInto('daily_visits')
      .values({ day, visitor_id: visitorId, kind })
      .onConflict((oc) =>
        oc.columns(['day', 'visitor_id']).doUpdateSet({
          kind: sql`case when ${rank} > ${old} then excluded.kind else daily_visits.kind end`,
          sessions: sql`daily_visits.sessions + ${newSession ? 1 : 0}::int`,
        }),
      )
      .execute();
  }

  async counts(days: string[]) {
    const rows = await this.db
      .selectFrom('daily_visits')
      .select([
        'day',
        'kind',
        (eb) => eb.fn.countAll<string>().as('n'),
        (eb) => eb.fn.sum<string>('sessions').as('sessions'),
      ])
      .where('day', 'in', days)
      .groupBy(['day', 'kind'])
      .execute();
    return days.map((day) => {
      const out = emptyDay(day);
      for (const r of rows) {
        if (r.day !== day) continue;
        const n = Number(r.n);
        out[r.kind as VisitorKind] += n;
        out.total += n;
        out.sessions += Number(r.sessions);
      }
      return out;
    });
  }

  async totals(from: string, to: string) {
    const res = await sql<{ rank: number; n: string; sessions: string }>`
      select rank, count(*) as n, sum(sessions) as sessions
      from (
        select visitor_id,
          max(case kind when 'registered' then 2 when 'guest' then 1 else 0 end) as rank,
          sum(sessions) as sessions
        from daily_visits
        where day >= ${from} and day <= ${to}
        group by visitor_id
      ) as visitors
      group by rank
    `.execute(this.db);
    const out = noVisitors();
    const kinds = ['anonymous', 'guest', 'registered'] as const;
    for (const r of res.rows) {
      const n = Number(r.n);
      out[kinds[r.rank]!] += n;
      out.total += n;
      out.sessions += Number(r.sessions);
    }
    return out;
  }

  async since() {
    const row = await this.db
      .selectFrom('daily_visits')
      .select(sql<string | null>`min(day)`.as('day'))
      .executeTakeFirstOrThrow();
    return row.day;
  }

  async prune(day: string) {
    await this.db.deleteFrom('daily_visits').where('day', '<', day).execute();
  }
}
