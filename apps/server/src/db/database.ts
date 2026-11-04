import { Kysely, PostgresDialect, sql, type Generated } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import pg from 'pg';

export interface UsersTable {
  id: string;
  kind: 'guest' | 'registered';
  display_name: string;
  email: string | null;
  password_hash: string | null;
  created_at: Generated<Date>;
}

export interface MatchesTable {
  id: string;
  room_code: string;
  game_id: string;
  rules_version: number;
  config: unknown;
  time_control: unknown;
  /** Secret until ended_at is set. */
  seed: string;
  status: 'playing' | 'finished';
  result: unknown | null;
  started_at: Date;
  ended_at: Date | null;
}

export interface MatchPlayersTable {
  match_id: string;
  seat: number;
  user_id: string | null;
  bot_level: string | null;
}

export interface MatchMovesTable {
  match_id: string;
  idx: number;
  seat: number;
  move: unknown;
  elapsed_ms: number;
  created_at: Date;
}

export interface Database {
  users: UsersTable;
  matches: MatchesTable;
  match_players: MatchPlayersTable;
  match_moves: MatchMovesTable;
}

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 10 }) }),
  });
}

/** Migrations live in code so they ship with the server. Never edit one that has run; add a new one. */
const MIGRATIONS: Record<string, Migration> = {
  '2026_11_05_001_initial': {
    async up(db) {
      await db.schema
        .createTable('users')
        .addColumn('id', 'uuid', (c) => c.primaryKey())
        .addColumn('kind', 'text', (c) => c.notNull())
        .addColumn('display_name', 'text', (c) => c.notNull())
        .addColumn('email', 'text', (c) => c.unique())
        .addColumn('password_hash', 'text')
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema
        .createTable('matches')
        .addColumn('id', 'uuid', (c) => c.primaryKey())
        .addColumn('room_code', 'text', (c) => c.notNull())
        .addColumn('game_id', 'text', (c) => c.notNull())
        .addColumn('rules_version', 'integer', (c) => c.notNull())
        .addColumn('config', 'jsonb', (c) => c.notNull())
        .addColumn('time_control', 'jsonb', (c) => c.notNull())
        .addColumn('seed', 'text', (c) => c.notNull())
        .addColumn('status', 'text', (c) => c.notNull())
        .addColumn('result', 'jsonb')
        .addColumn('started_at', 'timestamptz', (c) => c.notNull())
        .addColumn('ended_at', 'timestamptz')
        .execute();
      await db.schema
        .createIndex('matches_game_ended')
        .on('matches')
        .columns(['game_id', 'ended_at'])
        .execute();
      await db.schema
        .createTable('match_players')
        .addColumn('match_id', 'uuid', (c) => c.notNull().references('matches.id').onDelete('cascade'))
        .addColumn('seat', 'integer', (c) => c.notNull())
        .addColumn('user_id', 'uuid', (c) => c.references('users.id'))
        .addColumn('bot_level', 'text')
        .addPrimaryKeyConstraint('match_players_pk', ['match_id', 'seat'])
        .execute();
      await db.schema.createIndex('match_players_user').on('match_players').column('user_id').execute();
      await db.schema
        .createTable('match_moves')
        .addColumn('match_id', 'uuid', (c) => c.notNull().references('matches.id').onDelete('cascade'))
        .addColumn('idx', 'integer', (c) => c.notNull())
        .addColumn('seat', 'integer', (c) => c.notNull())
        .addColumn('move', 'jsonb', (c) => c.notNull())
        .addColumn('elapsed_ms', 'integer', (c) => c.notNull())
        .addColumn('created_at', 'timestamptz', (c) => c.notNull())
        .addPrimaryKeyConstraint('match_moves_pk', ['match_id', 'idx'])
        .execute();
    },
    async down(db) {
      for (const t of ['match_moves', 'match_players', 'matches', 'users'])
        await db.schema.dropTable(t).execute();
    },
  },
};

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => MIGRATIONS } });
  const { error, results } = await migrator.migrateToLatest();
  const failed = results?.find((r) => r.status === 'Error');
  if (error || failed)
    throw new Error(`migration failed: ${failed?.migrationName ?? ''} ${String(error ?? '')}`);
}
