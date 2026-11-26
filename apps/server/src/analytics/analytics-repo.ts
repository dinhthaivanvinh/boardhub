import { vnDay, type LearnKind, type ReportReason } from '@bg/protocol';
import type { MemoryAdminRepo } from '../admin/admin-repo';
import type { MemoryLearnEventRepo } from '../stats/learn-events';
import type { MemoryHistoryRepo, MemoryUserRepo } from '../store/repos';

export type AccountKind = 'guest' | 'registered';
export interface KindCounts {
  guest: number;
  registered: number;
}
export interface DayCount {
  day: string;
  n: number;
}

export interface LearnDayRow {
  day: string;
  learners: number;
  lesson: number;
  practice: number;
  puzzle: number;
}

/** Over a range: the children who did anything, and per kind the finishes, one per child and item. */
export interface LearnTotals {
  learners: number;
  lesson: number;
  practice: number;
  puzzle: number;
}

/** Something that happened, with account ids still to be turned into names. */
export type RawActivity =
  | { type: 'signup'; at: number; userId: string; kind: AccountKind }
  | { type: 'match'; at: number; gameId: string; players: (string | null)[] }
  | { type: 'report'; at: number; targetId: string; reason: ReportReason }
  | { type: 'learn'; at: number; userId: string | null; kind: LearnKind; itemId: string };

/**
 * Counts for the admin dashboard, read from what the other repos store. Moments are epoch ms with `from`
 * included and `to` excluded; days are `YYYY-MM-DD` in Vietnam time, both ends included.
 */
export interface AnalyticsRepo {
  accountsBefore(at: number): Promise<KindCounts>;
  newAccounts(from: number, to: number): Promise<(DayCount & { kind: AccountKind })[]>;
  matchesBefore(gameId: string, at: number): Promise<number>;
  matchesByDay(gameId: string, from: number, to: number): Promise<DayCount[]>;
  learnByDay(from: string, to: string): Promise<LearnDayRow[]>;
  learnTotals(from: string, to: string): Promise<LearnTotals>;
  /** Children who finished each lesson in the range. */
  lessonLearners(from: string, to: string): Promise<{ itemId: string; learners: number }[]>;
  learningSince(): Promise<string | null>;
  /** How many of these lessons and puzzles all accounts together have saved in their progress. */
  savedProgress(lessonIds: string[], puzzleIds: string[]): Promise<{ lessons: number; puzzles: number }>;
  /** The latest things of every type, newest first. */
  recent(limit: number): Promise<RawActivity[]>;
}

export const noCounts = (): KindCounts => ({ guest: 0, registered: 0 });

const tally = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
};
const distinct = <T>(rows: T[], key: (row: T) => string) => new Set(rows.map(key)).size;

export class MemoryAnalyticsRepo implements AnalyticsRepo {
  constructor(
    private readonly users: MemoryUserRepo,
    private readonly history: MemoryHistoryRepo,
    private readonly learn: MemoryLearnEventRepo,
    private readonly admin: MemoryAdminRepo,
  ) {}

  async accountsBefore(at: number) {
    const out = noCounts();
    for (const u of this.users.users.values()) if (u.createdAt < at) out[u.kind]++;
    return out;
  }

  async newAccounts(from: number, to: number) {
    const rows = [...this.users.users.values()].filter((u) => u.createdAt >= from && u.createdAt < to);
    return [...tally(rows, (u) => `${vnDay(u.createdAt)} ${u.kind}`).values()].map((group) => ({
      day: vnDay(group[0]!.createdAt),
      kind: group[0]!.kind,
      n: group.length,
    }));
  }

  private matches(gameId: string) {
    return [...this.history.matches.values()].filter((m) => m.gameId === gameId);
  }

  async matchesBefore(gameId: string, at: number) {
    return this.matches(gameId).filter((m) => m.startedAt < at).length;
  }

  async matchesByDay(gameId: string, from: number, to: number) {
    const rows = this.matches(gameId).filter((m) => m.startedAt >= from && m.startedAt < to);
    return [...tally(rows, (m) => vnDay(m.startedAt))].map(([day, group]) => ({ day, n: group.length }));
  }

  private events(from: string, to: string) {
    return this.learn.all().filter((e) => e.day >= from && e.day <= to);
  }

  async learnByDay(from: string, to: string) {
    return [...tally(this.events(from, to), (e) => e.day)].map(([day, group]) => ({
      day,
      learners: distinct(group, (e) => e.actor),
      lesson: group.filter((e) => e.kind === 'lesson').length,
      practice: group.filter((e) => e.kind === 'practice').length,
      puzzle: group.filter((e) => e.kind === 'puzzle').length,
    }));
  }

  async learnTotals(from: string, to: string) {
    const rows = this.events(from, to);
    const of = (kind: LearnKind) =>
      distinct(
        rows.filter((e) => e.kind === kind),
        (e) => `${e.actor} ${e.itemId}`,
      );
    return {
      learners: distinct(rows, (e) => e.actor),
      lesson: of('lesson'),
      practice: of('practice'),
      puzzle: of('puzzle'),
    };
  }

  async lessonLearners(from: string, to: string) {
    const rows = this.events(from, to).filter((e) => e.kind === 'lesson');
    return [...tally(rows, (e) => e.itemId)].map(([itemId, group]) => ({
      itemId,
      learners: distinct(group, (e) => e.actor),
    }));
  }

  async learningSince() {
    return (
      this.learn
        .all()
        .map((e) => e.day)
        .sort()[0] ?? null
    );
  }

  async savedProgress(lessonIds: string[], puzzleIds: string[]) {
    const lessons = new Set(lessonIds);
    const puzzles = new Set(puzzleIds);
    const out = { lessons: 0, puzzles: 0 };
    for (const stored of this.users.learnProgress.values()) {
      const p = stored as { lessons?: string[]; puzzles?: string[] };
      out.lessons += (p.lessons ?? []).filter((id) => lessons.has(id)).length;
      out.puzzles += (p.puzzles ?? []).filter((id) => puzzles.has(id)).length;
    }
    return out;
  }

  async recent(limit: number) {
    const latest = <T extends RawActivity>(rows: T[]) => rows.sort((a, b) => b.at - a.at).slice(0, limit);
    const all: RawActivity[] = [
      ...latest(
        [...this.users.users.values()].map((u) => ({
          type: 'signup' as const,
          at: u.createdAt,
          userId: u.id,
          kind: u.kind,
        })),
      ),
      ...latest(
        [...this.history.matches.values()].map((m) => ({
          type: 'match' as const,
          at: m.startedAt,
          gameId: m.gameId,
          players: m.players.map((p) => p.userId),
        })),
      ),
      ...latest(
        [...this.admin.reports.values()].map((r) => ({
          type: 'report' as const,
          at: r.createdAt,
          targetId: r.targetId,
          reason: r.reason,
        })),
      ),
      ...latest(
        this.learn.all().map((e) => ({
          type: 'learn' as const,
          at: e.at,
          userId: e.userId,
          kind: e.kind,
          itemId: e.itemId,
        })),
      ),
    ];
    return latest(all);
  }
}
