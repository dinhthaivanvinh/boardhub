import { randomUUID } from 'node:crypto';
import {
  SANCTION_FOREVER,
  type AdminGameSetting,
  type AdminReport,
  type ChatMessage,
  type ReportAction,
  type ReportCreate,
  type SanctionedUser,
  type UserSanctions,
} from '@bg/protocol';
import type { z } from 'zod';
import { HubError } from '../errors';
import type { UserRecord, UserRepo } from '../store/repos';
import type { AdminRepo, SanctionsPatch, StoredReport } from './admin-repo';

/** A reporter may file this many reports per hour. */
export const REPORTS_PER_HOUR = 10;
/** The target's chat lines attached to a report. */
export const EVIDENCE_LINES = 20;
/** How long the list of disabled games is cached (each process re-reads it after this). */
const GAMES_CACHE_MS = 2_000;
const HOUR = 3_600_000;

export interface AdminServiceOptions {
  repo: AdminRepo;
  users: UserRepo;
  gameIds: string[];
  /** Emails (lower case) of registered users who may use /admin (config ADMIN_EMAILS). */
  adminEmails: string[];
  /** The room's chat (for evidence), by room code. */
  roomChat(code: string): Promise<ChatMessage[]>;
  /** Called after a ban: drop the user's connections and queue entries. */
  onBanned?(userId: string): Promise<void>;
  now?: () => number;
  newId?: () => string;
}

/**
 * Admin and moderation (FR-CAT-03, FR-ADM-02): turn games on and off, take player reports,
 * mute and ban. Checks for "is this user banned / muted" happen here too, on every request.
 */
export class AdminService {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly admins: Set<string>;
  private disabledCache: { at: number; ids: Set<string> } | null = null;

  constructor(private readonly o: AdminServiceOptions) {
    this.now = o.now ?? Date.now;
    this.newId = o.newId ?? randomUUID;
    this.admins = new Set(o.adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  }

  isAdmin(user: UserRecord): boolean {
    return user.kind === 'registered' && !!user.email && this.admins.has(user.email.toLowerCase());
  }

  requireAdmin(user: UserRecord): void {
    if (!this.isAdmin(user)) throw new HubError('admin.required');
  }

  // ---------------------------------------------------------------- games

  async disabledGames(): Promise<Set<string>> {
    const now = this.now();
    if (this.disabledCache && now - this.disabledCache.at < GAMES_CACHE_MS) return this.disabledCache.ids;
    const rows = await this.o.repo.gameSettings();
    const ids = new Set(rows.filter((r) => !r.enabled).map((r) => r.gameId));
    this.disabledCache = { at: now, ids };
    return ids;
  }

  async isGameEnabled(gameId: string): Promise<boolean> {
    return !(await this.disabledGames()).has(gameId);
  }

  async gameSettings(): Promise<AdminGameSetting[]> {
    const rows = new Map((await this.o.repo.gameSettings()).map((r) => [r.gameId, r]));
    return this.o.gameIds.map((gameId) => {
      const row = rows.get(gameId);
      return { gameId, enabled: row?.enabled ?? true, updatedAt: row?.updatedAt ?? null };
    });
  }

  async setGameEnabled(admin: UserRecord, gameId: string, enabled: boolean): Promise<AdminGameSetting> {
    this.requireAdmin(admin);
    if (!this.o.gameIds.includes(gameId)) throw new HubError('game.not_found');
    const at = this.now();
    await this.o.repo.setGameEnabled(gameId, enabled, admin.id, at);
    this.disabledCache = null;
    return { gameId, enabled, updatedAt: at };
  }

  // ---------------------------------------------------------------- sanctions

  async sanctionsOf(userId: string): Promise<UserSanctions> {
    const s = (await this.o.repo.getSanctions([userId])).get(userId);
    return this.active(s ?? { mutedUntil: null, bannedUntil: null });
  }

  async isBanned(userId: string): Promise<boolean> {
    return (await this.sanctionsOf(userId)).bannedUntil !== null;
  }

  async isMuted(userId: string): Promise<boolean> {
    return (await this.sanctionsOf(userId)).mutedUntil !== null;
  }

  async setSanctions(admin: UserRecord, userId: string, patch: SanctionsPatch): Promise<UserSanctions> {
    this.requireAdmin(admin);
    if (userId === admin.id) throw new HubError('report.self');
    if (!(await this.o.users.findById(userId))) throw new HubError('user.not_found');
    await this.o.repo.setSanctions(userId, patch, admin.id, this.now());
    const now = await this.sanctionsOf(userId);
    if (patch.bannedUntil && now.bannedUntil) await this.o.onBanned?.(userId);
    return now;
  }

  async sanctioned(admin: UserRecord): Promise<SanctionedUser[]> {
    this.requireAdmin(admin);
    const rows = await this.o.repo.listSanctioned(this.now(), 200);
    const names = await this.names(rows.map((r) => r.userId));
    return rows.map((r) => ({
      id: r.userId,
      name: names.get(r.userId)?.displayName ?? '?',
      ...this.active(r),
    }));
  }

  // ---------------------------------------------------------------- reports

  async report(reporter: UserRecord, input: z.output<typeof ReportCreate>): Promise<{ id: string }> {
    if (input.targetUserId === reporter.id) throw new HubError('report.self');
    if (!(await this.o.users.findById(input.targetUserId))) throw new HubError('user.not_found');
    if (await this.o.repo.hasOpenReport(reporter.id, input.targetUserId))
      throw new HubError('report.duplicate');
    const now = this.now();
    if ((await this.o.repo.countReportsBy(reporter.id, now - HOUR)) >= REPORTS_PER_HOUR)
      throw new HubError('report.too_many');

    // Chat lives only in the live store for a day, so keep what the target said with the report.
    const chat = input.roomCode ? await this.o.roomChat(input.roomCode).catch(() => []) : [];
    const evidence = chat
      .filter((m) => m.from.userId === input.targetUserId)
      .slice(-EVIDENCE_LINES)
      .map((m) => ({ text: m.text, at: m.at }));

    const id = this.newId();
    await this.o.repo.createReport({
      id,
      reporterId: reporter.id,
      targetId: input.targetUserId,
      reason: input.reason,
      note: input.note,
      roomCode: input.roomCode ?? null,
      evidence,
      createdAt: now,
    });
    return { id };
  }

  async listReports(admin: UserRecord, status: 'open' | 'resolved'): Promise<AdminReport[]> {
    this.requireAdmin(admin);
    const rows = await this.o.repo.listReports(status, 100);
    return this.describe(rows);
  }

  /**
   * Decides a report. Mute and ban apply to the target for `hours` (null = until lifted); a longer
   * sanction that is already running is never shortened.
   */
  async resolve(
    admin: UserRecord,
    reportId: string,
    action: ReportAction,
    hours: number | null,
  ): Promise<AdminReport> {
    this.requireAdmin(admin);
    const report = await this.o.repo.getReport(reportId);
    if (!report) throw new HubError('report.not_found');
    if (report.status !== 'open') throw new HubError('report.not_found');
    if (action !== 'dismiss') {
      if (report.targetId === admin.id) throw new HubError('report.self');
      const now = this.now();
      const until = hours === null ? SANCTION_FOREVER : now + hours * HOUR;
      const current = await this.sanctionsOf(report.targetId);
      const field = action === 'mute' ? 'mutedUntil' : 'bannedUntil';
      if ((current[field] ?? 0) < until) await this.setSanctions(admin, report.targetId, { [field]: until });
    }
    if (!(await this.o.repo.resolveReport(reportId, action, admin.id, this.now())))
      throw new HubError('report.not_found');
    const [described] = await this.describe([(await this.o.repo.getReport(reportId))!]);
    return described!;
  }

  // ---------------------------------------------------------------- helpers

  /** Sanctions that are over read as null. */
  private active(s: UserSanctions): UserSanctions {
    const now = this.now();
    return {
      mutedUntil: s.mutedUntil !== null && s.mutedUntil > now ? s.mutedUntil : null,
      bannedUntil: s.bannedUntil !== null && s.bannedUntil > now ? s.bannedUntil : null,
    };
  }

  private async names(ids: string[]) {
    return new Map((await this.o.users.findManyByIds([...new Set(ids)])).map((u) => [u.id, u]));
  }

  private async describe(rows: StoredReport[]): Promise<AdminReport[]> {
    const targets = [...new Set(rows.map((r) => r.targetId))];
    const [users, open, sanctions] = await Promise.all([
      this.names(rows.flatMap((r) => [r.reporterId, r.targetId])),
      this.o.repo.countOpenByTarget(targets),
      this.o.repo.getSanctions(targets),
    ]);
    return rows.map((r) => {
      const target = users.get(r.targetId);
      return {
        id: r.id,
        reporter: { id: r.reporterId, name: users.get(r.reporterId)?.displayName ?? '?' },
        target: { id: r.targetId, name: target?.displayName ?? '?', kind: target?.kind ?? 'guest' },
        reason: r.reason,
        note: r.note,
        roomCode: r.roomCode,
        evidence: r.evidence,
        status: r.status,
        action: r.action,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        openAgainstTarget: open.get(r.targetId) ?? 0,
        sanctions: this.active(sanctions.get(r.targetId) ?? { mutedUntil: null, bannedUntil: null }),
      };
    });
  }
}
