import type { ReportAction, ReportEvidenceLine, ReportReason, UserSanctions } from '@bg/protocol';

/** One player report as stored (docs/06 §1, player_reports). */
export interface StoredReport {
  id: string;
  reporterId: string;
  targetId: string;
  reason: ReportReason;
  note: string;
  roomCode: string | null;
  evidence: ReportEvidenceLine[];
  status: 'open' | 'resolved';
  action: ReportAction | null;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

export type NewReport = Omit<StoredReport, 'status' | 'action' | 'resolvedAt' | 'resolvedBy'>;

export interface StoredGameSetting {
  gameId: string;
  enabled: boolean;
  updatedAt: number;
}

/** Fields left undefined are kept; null lifts that sanction. */
export interface SanctionsPatch {
  mutedUntil?: number | null | undefined;
  bannedUntil?: number | null | undefined;
}

export interface StoredSanctions extends UserSanctions {
  userId: string;
}

/** Game switches, reports and sanctions (M4b). Games without a row are enabled. */
export interface AdminRepo {
  gameSettings(): Promise<StoredGameSetting[]>;
  setGameEnabled(gameId: string, enabled: boolean, by: string, at: number): Promise<void>;

  createReport(report: NewReport): Promise<void>;
  /** Reports made by this user since `since` (anti-spam). */
  countReportsBy(reporterId: string, since: number): Promise<number>;
  hasOpenReport(reporterId: string, targetId: string): Promise<boolean>;
  /** Newest first. */
  listReports(status: 'open' | 'resolved', limit: number): Promise<StoredReport[]>;
  getReport(id: string): Promise<StoredReport | null>;
  /** Closes an open report; false if it was not open (already handled by another admin). */
  resolveReport(id: string, action: ReportAction, by: string, at: number): Promise<boolean>;
  /** Open reports per target. */
  countOpenByTarget(targetIds: string[]): Promise<Map<string, number>>;

  getSanctions(userIds: string[]): Promise<Map<string, StoredSanctions>>;
  /** Fields left undefined are kept; null lifts that sanction. */
  setSanctions(userId: string, patch: SanctionsPatch, by: string, at: number): Promise<void>;
  /** Users with a mute or ban that ends after `now`. */
  listSanctioned(now: number, limit: number): Promise<StoredSanctions[]>;
}

export class MemoryAdminRepo implements AdminRepo {
  readonly games = new Map<string, StoredGameSetting>();
  readonly reports = new Map<string, StoredReport>();
  readonly sanctions = new Map<string, StoredSanctions>();

  async gameSettings() {
    return [...this.games.values()].map((g) => ({ ...g }));
  }

  async setGameEnabled(gameId: string, enabled: boolean, _by: string, at: number) {
    this.games.set(gameId, { gameId, enabled, updatedAt: at });
  }

  async createReport(report: NewReport) {
    this.reports.set(report.id, {
      ...structuredClone(report),
      status: 'open',
      action: null,
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  async countReportsBy(reporterId: string, since: number) {
    return [...this.reports.values()].filter((r) => r.reporterId === reporterId && r.createdAt >= since)
      .length;
  }

  async hasOpenReport(reporterId: string, targetId: string) {
    return [...this.reports.values()].some(
      (r) => r.reporterId === reporterId && r.targetId === targetId && r.status === 'open',
    );
  }

  async listReports(status: 'open' | 'resolved', limit: number) {
    return [...this.reports.values()]
      .filter((r) => r.status === status)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }

  async getReport(id: string) {
    const r = this.reports.get(id);
    return r ? structuredClone(r) : null;
  }

  async resolveReport(id: string, action: ReportAction, by: string, at: number) {
    const r = this.reports.get(id);
    if (!r || r.status !== 'open') return false;
    Object.assign(r, { status: 'resolved', action, resolvedAt: at, resolvedBy: by });
    return true;
  }

  async countOpenByTarget(targetIds: string[]) {
    const counts = new Map<string, number>();
    for (const r of this.reports.values())
      if (r.status === 'open' && targetIds.includes(r.targetId))
        counts.set(r.targetId, (counts.get(r.targetId) ?? 0) + 1);
    return counts;
  }

  async getSanctions(userIds: string[]) {
    const out = new Map<string, StoredSanctions>();
    for (const id of userIds) {
      const s = this.sanctions.get(id);
      if (s) out.set(id, { ...s });
    }
    return out;
  }

  async setSanctions(userId: string, patch: SanctionsPatch) {
    const current = this.sanctions.get(userId) ?? { userId, mutedUntil: null, bannedUntil: null };
    this.sanctions.set(userId, {
      userId,
      mutedUntil: patch.mutedUntil !== undefined ? patch.mutedUntil : current.mutedUntil,
      bannedUntil: patch.bannedUntil !== undefined ? patch.bannedUntil : current.bannedUntil,
    });
  }

  async listSanctioned(now: number, limit: number) {
    return [...this.sanctions.values()]
      .filter((s) => (s.mutedUntil ?? 0) > now || (s.bannedUntil ?? 0) > now)
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }
}
