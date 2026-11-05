import type { Kysely, Selectable } from 'kysely';
import type { GameResult } from '@bg/engine';
import type {
  HistoryRepo,
  NewMatchRow,
  StoredMatch,
  StoredMatchSummary,
  UserRecord,
  UserRepo,
} from '../store/repos';
import { fresh, type RatingRepo, type StoredRating } from '../ratings/rating-service';
import type { Database, MatchesTable, RatingsTable, UsersTable } from './database';

const json = (value: unknown) => JSON.stringify(value);

function toUser(row: Selectable<UsersTable>): UserRecord {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at.getTime(),
  };
}

export class PgUserRepo implements UserRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async create(user: Omit<UserRecord, 'createdAt'>) {
    const row = await this.db
      .insertInto('users')
      .values({
        id: user.id,
        kind: user.kind,
        display_name: user.displayName,
        email: user.email,
        password_hash: user.passwordHash,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toUser(row);
  }

  async getAvatar(id: string) {
    const row = await this.db.selectFrom('users').select('avatar').where('id', '=', id).executeTakeFirst();
    return row?.avatar ?? null;
  }

  async setAvatar(id: string, avatar: unknown) {
    const res = await this.db
      .updateTable('users')
      .set({ avatar: JSON.stringify(avatar) })
      .where('id', '=', id)
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }

  async findById(id: string) {
    const row = await this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string) {
    const row = await this.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    return row ? toUser(row) : null;
  }

  async findManyByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.selectFrom('users').selectAll().where('id', 'in', ids).execute();
    return rows.map(toUser);
  }

  async update(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>) {
    const values = {
      ...(patch.kind !== undefined && { kind: patch.kind }),
      ...(patch.displayName !== undefined && { display_name: patch.displayName }),
      ...(patch.email !== undefined && { email: patch.email }),
      ...(patch.passwordHash !== undefined && { password_hash: patch.passwordHash }),
    };
    if (Object.keys(values).length === 0) return this.findById(id);
    const row = await this.db
      .updateTable('users')
      .set(values)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toUser(row) : null;
  }
}

export class PgHistoryRepo implements HistoryRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async createMatch(m: NewMatchRow) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('matches')
        .values({
          id: m.id,
          room_code: m.roomCode,
          game_id: m.gameId,
          rules_version: m.rulesVersion,
          config: json(m.config),
          time_control: json(m.timeControl),
          seed: m.seed,
          status: 'playing',
          ranked: m.ranked,
          result: null,
          started_at: new Date(m.startedAt),
          ended_at: null,
        })
        .execute();
      if (m.players.length > 0) {
        await trx
          .insertInto('match_players')
          .values(
            m.players.map((p) => ({
              match_id: m.id,
              seat: p.seat,
              user_id: p.userId,
              bot_level: p.botLevel,
              rating_before: null,
              rating_after: null,
            })),
          )
          .execute();
      }
    });
  }

  async addMove(matchId: string, index: number, seat: number, move: unknown, elapsedMs: number, at: number) {
    await this.db
      .insertInto('match_moves')
      .values({
        match_id: matchId,
        idx: index,
        seat,
        move: json(move),
        elapsed_ms: elapsedMs,
        created_at: new Date(at),
      })
      .execute();
  }

  async setRatingChanges(matchId: string, changes: { seat: number; before: number; after: number }[]) {
    for (const c of changes) {
      await this.db
        .updateTable('match_players')
        .set({ rating_before: c.before, rating_after: c.after })
        .where('match_id', '=', matchId)
        .where('seat', '=', c.seat)
        .execute();
    }
  }

  async finishMatch(matchId: string, result: GameResult, endedAt: number) {
    await this.db
      .updateTable('matches')
      .set({ status: 'finished', result: json(result), ended_at: new Date(endedAt) })
      .where('id', '=', matchId)
      .execute();
  }

  async listForUser(userId: string, limit: number): Promise<StoredMatchSummary[]> {
    const rows = await this.db
      .selectFrom('matches')
      .innerJoin('match_players as me', 'me.match_id', 'matches.id')
      .selectAll('matches')
      .where('me.user_id', '=', userId)
      .orderBy('matches.started_at', 'desc')
      .limit(limit)
      .execute();
    const players = await this.playersOf(rows.map((r) => r.id));
    return rows.map((r) => toSummary(r, players.get(r.id) ?? []));
  }

  async getMatch(id: string): Promise<StoredMatch | null> {
    const row = await this.db.selectFrom('matches').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const players = await this.playersOf([id]);
    const moves = await this.db
      .selectFrom('match_moves')
      .select(['seat', 'move'])
      .where('match_id', '=', id)
      .orderBy('idx')
      .execute();
    return {
      ...toSummary(row, players.get(id) ?? []),
      rulesVersion: row.rules_version,
      config: row.config as Record<string, unknown>,
      seed: row.seed,
      moves: moves.map((m) => ({ seat: m.seat, move: m.move })),
    };
  }

  private async playersOf(matchIds: string[]) {
    const byMatch = new Map<string, StoredMatchSummary['players']>();
    if (matchIds.length === 0) return byMatch;
    const rows = await this.db
      .selectFrom('match_players')
      .selectAll()
      .where('match_id', 'in', matchIds)
      .orderBy('seat')
      .execute();
    for (const p of rows) {
      const list = byMatch.get(p.match_id) ?? [];
      list.push({ seat: p.seat, userId: p.user_id, botLevel: p.bot_level });
      byMatch.set(p.match_id, list);
    }
    return byMatch;
  }
}

function toSummary(
  row: Selectable<MatchesTable>,
  players: StoredMatchSummary['players'],
): StoredMatchSummary {
  return {
    id: row.id,
    roomCode: row.room_code,
    gameId: row.game_id,
    status: row.status,
    result: (row.result as GameResult | null) ?? null,
    startedAt: row.started_at.getTime(),
    endedAt: row.ended_at?.getTime() ?? null,
    players,
  };
}

function toRating(row: Selectable<RatingsTable>): StoredRating {
  return {
    userId: row.user_id,
    gameId: row.game_id,
    rating: row.rating,
    rd: row.rd,
    volatility: row.volatility,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
  };
}

export class PgRatingRepo implements RatingRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async get(userId: string, gameId: string) {
    const row = await this.db
      .selectFrom('ratings')
      .selectAll()
      .where('user_id', '=', userId)
      .where('game_id', '=', gameId)
      .executeTakeFirst();
    return row ? toRating(row) : fresh(userId, gameId);
  }

  async save(r: StoredRating) {
    const values = {
      user_id: r.userId,
      game_id: r.gameId,
      rating: r.rating,
      rd: r.rd,
      volatility: r.volatility,
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
    };
    await this.db
      .insertInto('ratings')
      .values(values)
      .onConflict((oc) =>
        oc.columns(['user_id', 'game_id']).doUpdateSet({ ...values, updated_at: new Date() }),
      )
      .execute();
  }

  async top(gameId: string, limit: number, minGames: number) {
    const rows = await this.db
      .selectFrom('ratings')
      .selectAll()
      .where('game_id', '=', gameId)
      .where('games', '>=', minGames)
      .orderBy('rating', 'desc')
      .limit(limit)
      .execute();
    return rows.map(toRating);
  }

  async forUser(userId: string) {
    const rows = await this.db.selectFrom('ratings').selectAll().where('user_id', '=', userId).execute();
    return rows.map(toRating);
  }
}
