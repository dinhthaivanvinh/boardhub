import { Kysely, PostgresDialect, sql, type ColumnType, type Generated } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import pg from 'pg';

export interface UsersTable {
  id: string;
  kind: 'guest' | 'registered';
  display_name: string;
  email: string | null;
  password_hash: string | null;
  created_at: Generated<Date>;
  /** Office avatar (docs/office/05), validated by @bg/avatars before it is written. Written as JSON text. */
  avatar: ColumnType<unknown, never, string | null>;
  /** Learning progress (lessons done, puzzles solved, days played), validated by @bg/protocol. Written as JSON text. */
  learn_progress: ColumnType<unknown, never, string | null>;
  /** When the account was last used (written at most every few minutes); null if not since this was added. */
  last_seen_at: ColumnType<Date | null, never, Date | null>;
}

export interface RolesTable {
  id: string;
}

/** Which account has which admin role. */
export interface UserRolesTable {
  user_id: string;
  role_id: string;
  /** The admin who granted it; null when the server did (first super admin). */
  granted_by: string | null;
  granted_at: Date;
}

/** One lesson, practice or puzzle finished by someone on a day, as it happens. */
export interface LearnEventsTable {
  /** `YYYY-MM-DD` as text, Vietnam time. */
  day: string;
  /** `u:<user id>` when signed in, else `v:<random browser id>`. */
  actor: string;
  user_id: string | null;
  kind: 'lesson' | 'practice' | 'puzzle';
  item_id: string;
  created_at: Date;
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
  ranked: Generated<boolean>;
}

export interface MatchPlayersTable {
  match_id: string;
  seat: number;
  user_id: string | null;
  bot_level: string | null;
  rating_before: number | null;
  rating_after: number | null;
}

export interface MatchMovesTable {
  match_id: string;
  idx: number;
  seat: number;
  move: unknown;
  elapsed_ms: number;
  created_at: Date;
}

export interface RatingsTable {
  user_id: string;
  game_id: string;
  rating: number;
  rd: number;
  volatility: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  updated_at: Generated<Date>;
}

export interface OfficeSessionsTable {
  code: string;
  activity_id: string;
  title: string;
  host_user_id: string;
  status: string;
  created_at: Date;
  closed_at: Date | null;
}

export interface OfficeDrawsTable {
  id: string;
  session_code: string;
  round: number;
  mode: string;
  n: number;
  /** [{ id, name, avatar }] as they were when the draw started. */
  candidates: ColumnType<unknown, string, string>;
  commitment: string;
  seed: string;
  winners: ColumnType<string[], string, string>;
  /** Prize pool and the prize of each winner, for draws that hand out prizes (Lì xì). */
  prizes: ColumnType<string[] | null, string | null | undefined, string | null>;
  awarded: ColumnType<string[] | null, string | null | undefined, string | null>;
  starts_at: Date;
  reveal_at: Date;
  revealed_at: Date;
}

/** Admin switch per game (M4b). No row = enabled. */
export interface GameSettingsTable {
  game_id: string;
  enabled: boolean;
  updated_at: Date;
  updated_by: string | null;
}

export interface PlayerReportsTable {
  id: string;
  reporter_id: string;
  target_id: string;
  reason: string;
  note: string;
  room_code: string | null;
  /** The target's chat lines in that room at report time: [{ text, at }]. */
  evidence: ColumnType<unknown, string, string>;
  status: 'open' | 'resolved';
  action: string | null;
  created_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
}

/** Current mute/ban per user; a past end time means the sanction is over. */
export interface UserSanctionsTable {
  user_id: string;
  muted_until: Date | null;
  banned_until: Date | null;
  updated_at: Date;
  updated_by: string | null;
}

/** One row per visitor per day (Vietnam time): who used the site, for the admin statistics. */
export interface DailyVisitsTable {
  /** `YYYY-MM-DD` as text, so no time zone can move it. */
  day: string;
  visitor_id: string;
  kind: 'anonymous' | 'guest' | 'registered';
  /** How many separate visits that day (a new one after 30 minutes away). */
  sessions: Generated<number>;
}

/**
 * Which accounts visited on which day. It holds no browser id, so it cannot tie what a browser did while not
 * signed in to an account.
 */
export interface AccountVisitsTable {
  day: string;
  user_id: string;
}

export interface Database {
  account_visits: AccountVisitsTable;
  roles: RolesTable;
  user_roles: UserRolesTable;
  learn_events: LearnEventsTable;
  daily_visits: DailyVisitsTable;
  game_settings: GameSettingsTable;
  player_reports: PlayerReportsTable;
  user_sanctions: UserSanctionsTable;
  users: UsersTable;
  office_sessions: OfficeSessionsTable;
  office_draws: OfficeDrawsTable;
  ratings: RatingsTable;
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
  '2026_11_06_001_ratings': {
    async up(db) {
      await db.schema
        .createTable('ratings')
        .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
        .addColumn('game_id', 'text', (c) => c.notNull())
        .addColumn('rating', 'double precision', (c) => c.notNull())
        .addColumn('rd', 'double precision', (c) => c.notNull())
        .addColumn('volatility', 'double precision', (c) => c.notNull())
        .addColumn('games', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('wins', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('losses', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('draws', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addPrimaryKeyConstraint('ratings_pk', ['user_id', 'game_id'])
        .execute();
      await db.schema
        .createIndex('ratings_leaderboard')
        .on('ratings')
        .columns(['game_id', 'rating desc'])
        .execute();
      await db.schema
        .alterTable('matches')
        .addColumn('ranked', 'boolean', (c) => c.notNull().defaultTo(false))
        .execute();
      await db.schema.alterTable('match_players').addColumn('rating_before', 'double precision').execute();
      await db.schema.alterTable('match_players').addColumn('rating_after', 'double precision').execute();
    },
    async down(db) {
      await db.schema.alterTable('match_players').dropColumn('rating_after').execute();
      await db.schema.alterTable('match_players').dropColumn('rating_before').execute();
      await db.schema.alterTable('matches').dropColumn('ranked').execute();
      await db.schema.dropTable('ratings').execute();
    },
  },
  '2026_11_09_001_office_draws': {
    async up(db) {
      await db.schema
        .createTable('office_draws')
        .addColumn('id', 'uuid', (c) => c.primaryKey())
        .addColumn('session_code', 'text', (c) => c.notNull())
        .addColumn('round', 'integer', (c) => c.notNull())
        .addColumn('mode', 'text', (c) => c.notNull())
        .addColumn('n', 'integer', (c) => c.notNull())
        .addColumn('candidates', 'jsonb', (c) => c.notNull())
        .addColumn('commitment', 'text', (c) => c.notNull())
        .addColumn('seed', 'text', (c) => c.notNull())
        .addColumn('winners', 'jsonb', (c) => c.notNull())
        .addColumn('starts_at', 'timestamptz', (c) => c.notNull())
        .addColumn('reveal_at', 'timestamptz', (c) => c.notNull())
        .addColumn('revealed_at', 'timestamptz', (c) => c.notNull())
        .execute();
      await db.schema.createIndex('office_draws_session').on('office_draws').column('session_code').execute();
    },
    async down(db) {
      await db.schema.dropTable('office_draws').execute();
    },
  },
  '2026_11_08_001_office_sessions': {
    async up(db) {
      await db.schema
        .createTable('office_sessions')
        .addColumn('code', 'text', (c) => c.primaryKey())
        .addColumn('activity_id', 'text', (c) => c.notNull())
        .addColumn('title', 'text', (c) => c.notNull())
        .addColumn('host_user_id', 'uuid', (c) => c.notNull())
        .addColumn('status', 'text', (c) => c.notNull())
        .addColumn('created_at', 'timestamptz', (c) => c.notNull())
        .addColumn('closed_at', 'timestamptz')
        .execute();
    },
    async down(db) {
      await db.schema.dropTable('office_sessions').execute();
    },
  },
  '2026_11_10_001_admin': {
    async up(db) {
      await db.schema
        .createTable('game_settings')
        .addColumn('game_id', 'text', (c) => c.primaryKey())
        .addColumn('enabled', 'boolean', (c) => c.notNull())
        .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
        .addColumn('updated_by', 'uuid')
        .execute();
      await db.schema
        .createTable('player_reports')
        .addColumn('id', 'uuid', (c) => c.primaryKey())
        .addColumn('reporter_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
        .addColumn('target_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
        .addColumn('reason', 'text', (c) => c.notNull())
        .addColumn('note', 'text', (c) => c.notNull())
        .addColumn('room_code', 'text')
        .addColumn('evidence', 'jsonb', (c) => c.notNull())
        .addColumn('status', 'text', (c) => c.notNull())
        .addColumn('action', 'text')
        .addColumn('created_at', 'timestamptz', (c) => c.notNull())
        .addColumn('resolved_at', 'timestamptz')
        .addColumn('resolved_by', 'uuid')
        .execute();
      await db.schema
        .createIndex('player_reports_status')
        .on('player_reports')
        .columns(['status', 'created_at desc'])
        .execute();
      await db.schema.createIndex('player_reports_target').on('player_reports').column('target_id').execute();
      await db.schema
        .createIndex('player_reports_reporter')
        .on('player_reports')
        .columns(['reporter_id', 'created_at'])
        .execute();
      await db.schema
        .createTable('user_sanctions')
        .addColumn('user_id', 'uuid', (c) => c.primaryKey().references('users.id').onDelete('cascade'))
        .addColumn('muted_until', 'timestamptz')
        .addColumn('banned_until', 'timestamptz')
        .addColumn('updated_at', 'timestamptz', (c) => c.notNull())
        .addColumn('updated_by', 'uuid')
        .execute();
    },
    async down(db) {
      for (const t of ['user_sanctions', 'player_reports', 'game_settings'])
        await db.schema.dropTable(t).execute();
    },
  },
  '2026_11_11_001_draw_prizes': {
    async up(db) {
      await db.schema.alterTable('office_draws').addColumn('prizes', 'jsonb').execute();
      await db.schema.alterTable('office_draws').addColumn('awarded', 'jsonb').execute();
    },
    async down(db) {
      await db.schema.alterTable('office_draws').dropColumn('awarded').execute();
      await db.schema.alterTable('office_draws').dropColumn('prizes').execute();
    },
  },
  '2026_11_24_001_learn_progress': {
    async up(db) {
      await db.schema.alterTable('users').addColumn('learn_progress', 'jsonb').execute();
    },
    async down(db) {
      await db.schema.alterTable('users').dropColumn('learn_progress').execute();
    },
  },
  '2026_11_25_001_daily_visits': {
    async up(db) {
      await db.schema
        .createTable('daily_visits')
        .addColumn('day', 'text', (c) => c.notNull())
        .addColumn('visitor_id', 'text', (c) => c.notNull())
        .addColumn('kind', 'text', (c) => c.notNull())
        .addPrimaryKeyConstraint('daily_visits_pk', ['day', 'visitor_id'])
        .execute();
    },
    async down(db) {
      await db.schema.dropTable('daily_visits').execute();
    },
  },
  '2026_11_26_001_admin_roles_activity': {
    async up(db) {
      await db.schema
        .createTable('roles')
        .addColumn('id', 'text', (c) => c.primaryKey())
        .execute();
      await sql`insert into roles (id) values ('super_admin'), ('content_manager'), ('moderator'), ('analyst')`.execute(
        db,
      );
      await db.schema
        .createTable('user_roles')
        .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
        .addColumn('role_id', 'text', (c) => c.notNull().references('roles.id'))
        .addColumn('granted_by', 'uuid')
        .addColumn('granted_at', 'timestamptz', (c) => c.notNull())
        .addPrimaryKeyConstraint('user_roles_pk', ['user_id', 'role_id'])
        .execute();
      await db.schema.createIndex('user_roles_role').on('user_roles').column('role_id').execute();
      await db.schema.alterTable('users').addColumn('last_seen_at', 'timestamptz').execute();
      await db.schema
        .createTable('learn_events')
        .addColumn('day', 'text', (c) => c.notNull())
        .addColumn('actor', 'text', (c) => c.notNull())
        .addColumn('user_id', 'uuid', (c) => c.references('users.id').onDelete('cascade'))
        .addColumn('kind', 'text', (c) => c.notNull())
        .addColumn('item_id', 'text', (c) => c.notNull())
        .addColumn('created_at', 'timestamptz', (c) => c.notNull())
        .addPrimaryKeyConstraint('learn_events_pk', ['actor', 'day', 'kind', 'item_id'])
        .execute();
      await db.schema.createIndex('learn_events_day').on('learn_events').column('day').execute();
      await db.schema.createIndex('learn_events_user').on('learn_events').column('user_id').execute();
      // Days counted before this change had at least one visit each.
      await db.schema
        .alterTable('daily_visits')
        .addColumn('sessions', 'integer', (c) => c.notNull().defaultTo(1))
        .execute();
    },
    async down(db) {
      await db.schema.alterTable('daily_visits').dropColumn('sessions').execute();
      await db.schema.alterTable('users').dropColumn('last_seen_at').execute();
      for (const t of ['learn_events', 'user_roles', 'roles']) await db.schema.dropTable(t).execute();
    },
  },
  '2026_11_26_002_account_visits': {
    async up(db) {
      await db.schema
        .createTable('account_visits')
        .addColumn('day', 'text', (c) => c.notNull())
        .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
        .addPrimaryKeyConstraint('account_visits_pk', ['day', 'user_id'])
        .execute();
      await db.schema.createIndex('account_visits_user').on('account_visits').column('user_id').execute();
    },
    async down(db) {
      await db.schema.dropTable('account_visits').execute();
    },
  },
  '2026_11_07_001_avatars': {
    async up(db) {
      await db.schema.alterTable('users').addColumn('avatar', 'jsonb').execute();
    },
    async down(db) {
      await db.schema.alterTable('users').dropColumn('avatar').execute();
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
