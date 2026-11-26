import type { Kysely } from 'kysely';
import type { LearnEvent, LearnEventRepo } from '../stats/learn-events';
import type { Database } from './database';

export class PgLearnEventRepo implements LearnEventRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async record(e: LearnEvent) {
    await this.db
      .insertInto('learn_events')
      .values({
        day: e.day,
        actor: e.actor,
        user_id: e.userId,
        kind: e.kind,
        item_id: e.itemId,
        created_at: new Date(e.at),
      })
      .onConflict((oc) => oc.columns(['actor', 'day', 'kind', 'item_id']).doNothing())
      .execute();
  }

  async listDay(day: string) {
    const rows = await this.db
      .selectFrom('learn_events')
      .selectAll()
      .where('day', '=', day)
      .orderBy('created_at')
      .execute();
    return rows.map((r) => ({
      day: r.day,
      actor: r.actor,
      userId: r.user_id,
      kind: r.kind,
      itemId: r.item_id,
      at: r.created_at.getTime(),
    }));
  }

  async prune(day: string) {
    await this.db.deleteFrom('learn_events').where('day', '<', day).execute();
  }
}
