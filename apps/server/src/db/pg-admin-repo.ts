import { sql, type Kysely, type Selectable } from 'kysely';
import type { ReportAction, RoleId } from '@bg/protocol';
import type {
  AdminRepo,
  NewReport,
  SanctionsPatch,
  StoredReport,
  StoredSanctions,
} from '../admin/admin-repo';
import type { Database, PlayerReportsTable, UserSanctionsTable } from './database';

const ms = (d: Date | null) => (d ? d.getTime() : null);
const date = (n: number | null) => (n === null ? null : new Date(n));

function toReport(row: Selectable<PlayerReportsTable>): StoredReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetId: row.target_id,
    reason: row.reason as StoredReport['reason'],
    note: row.note,
    roomCode: row.room_code,
    evidence: row.evidence as StoredReport['evidence'],
    status: row.status,
    action: row.action as ReportAction | null,
    createdAt: row.created_at.getTime(),
    resolvedAt: ms(row.resolved_at),
    resolvedBy: row.resolved_by,
  };
}

function toSanctions(row: Selectable<UserSanctionsTable>): StoredSanctions {
  return { userId: row.user_id, mutedUntil: ms(row.muted_until), bannedUntil: ms(row.banned_until) };
}

export class PgAdminRepo implements AdminRepo {
  constructor(private readonly db: Kysely<Database>) {}

  async rolesOf(userId: string) {
    const rows = await this.db
      .selectFrom('user_roles')
      .select('role_id')
      .where('user_id', '=', userId)
      .execute();
    return rows.map((r) => r.role_id as RoleId);
  }

  async grantRole(userId: string, role: RoleId, by: string | null, at: number) {
    await this.db
      .insertInto('user_roles')
      .values({ user_id: userId, role_id: role, granted_by: by, granted_at: new Date(at) })
      .onConflict((oc) => oc.columns(['user_id', 'role_id']).doNothing())
      .execute();
  }

  async roleTaken(role: RoleId) {
    const row = await this.db
      .selectFrom('user_roles')
      .select('user_id')
      .where('role_id', '=', role)
      .limit(1)
      .executeTakeFirst();
    return row !== undefined;
  }

  async gameSettings() {
    const rows = await this.db.selectFrom('game_settings').selectAll().execute();
    return rows.map((r) => ({ gameId: r.game_id, enabled: r.enabled, updatedAt: r.updated_at.getTime() }));
  }

  async setGameEnabled(gameId: string, enabled: boolean, by: string, at: number) {
    const values = { enabled, updated_at: new Date(at), updated_by: by };
    await this.db
      .insertInto('game_settings')
      .values({ game_id: gameId, ...values })
      .onConflict((oc) => oc.column('game_id').doUpdateSet(values))
      .execute();
  }

  async createReport(r: NewReport) {
    await this.db
      .insertInto('player_reports')
      .values({
        id: r.id,
        reporter_id: r.reporterId,
        target_id: r.targetId,
        reason: r.reason,
        note: r.note,
        room_code: r.roomCode,
        evidence: JSON.stringify(r.evidence),
        status: 'open',
        action: null,
        created_at: new Date(r.createdAt),
        resolved_at: null,
        resolved_by: null,
      })
      .execute();
  }

  async countReportsBy(reporterId: string, since: number) {
    const row = await this.db
      .selectFrom('player_reports')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('reporter_id', '=', reporterId)
      .where('created_at', '>=', new Date(since))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async hasOpenReport(reporterId: string, targetId: string) {
    const row = await this.db
      .selectFrom('player_reports')
      .select('id')
      .where('reporter_id', '=', reporterId)
      .where('target_id', '=', targetId)
      .where('status', '=', 'open')
      .executeTakeFirst();
    return row !== undefined;
  }

  async listReports(status: 'open' | 'resolved', limit: number) {
    const rows = await this.db
      .selectFrom('player_reports')
      .selectAll()
      .where('status', '=', status)
      .orderBy(status === 'open' ? 'created_at' : 'resolved_at', 'desc')
      .limit(limit)
      .execute();
    return rows.map(toReport);
  }

  async getReport(id: string) {
    const row = await this.db
      .selectFrom('player_reports')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toReport(row) : null;
  }

  async resolveReport(id: string, action: ReportAction, by: string, at: number) {
    const res = await this.db
      .updateTable('player_reports')
      .set({ status: 'resolved', action, resolved_at: new Date(at), resolved_by: by })
      .where('id', '=', id)
      .where('status', '=', 'open')
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }

  async countOpenByTarget(targetIds: string[]) {
    const counts = new Map<string, number>();
    if (targetIds.length === 0) return counts;
    const rows = await this.db
      .selectFrom('player_reports')
      .select(['target_id', (eb) => eb.fn.countAll<string>().as('n')])
      .where('status', '=', 'open')
      .where('target_id', 'in', targetIds)
      .groupBy('target_id')
      .execute();
    for (const r of rows) counts.set(r.target_id, Number(r.n));
    return counts;
  }

  async getSanctions(userIds: string[]) {
    const out = new Map<string, StoredSanctions>();
    if (userIds.length === 0) return out;
    const rows = await this.db
      .selectFrom('user_sanctions')
      .selectAll()
      .where('user_id', 'in', userIds)
      .execute();
    for (const r of rows) out.set(r.user_id, toSanctions(r));
    return out;
  }

  async setSanctions(userId: string, patch: SanctionsPatch, by: string, at: number) {
    const set = {
      ...(patch.mutedUntil !== undefined && { muted_until: date(patch.mutedUntil) }),
      ...(patch.bannedUntil !== undefined && { banned_until: date(patch.bannedUntil) }),
      updated_at: new Date(at),
      updated_by: by,
    };
    await this.db
      .insertInto('user_sanctions')
      .values({
        user_id: userId,
        muted_until: date(patch.mutedUntil ?? null),
        banned_until: date(patch.bannedUntil ?? null),
        updated_at: new Date(at),
        updated_by: by,
      })
      .onConflict((oc) => oc.column('user_id').doUpdateSet(set))
      .execute();
  }

  async listSanctioned(now: number, limit: number) {
    const at = new Date(now);
    const rows = await this.db
      .selectFrom('user_sanctions')
      .selectAll()
      .where((eb) => eb.or([eb('muted_until', '>', at), eb('banned_until', '>', at)]))
      .orderBy(sql`greatest(coalesce(muted_until, 'epoch'), coalesce(banned_until, 'epoch'))`, 'desc')
      .limit(limit)
      .execute();
    return rows.map(toSanctions);
  }
}
