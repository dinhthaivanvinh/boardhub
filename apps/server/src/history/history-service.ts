import type { MatchDetail, MatchSummary } from '@bg/protocol';
import { HubError } from '../errors';
import type { HistoryRepo, StoredMatchSummary, UserRepo } from '../store/repos';

/** Read side of match history: adds player names, and reveals seeds only for finished matches. */
export class HistoryService {
  constructor(
    private readonly history: HistoryRepo,
    private readonly users: UserRepo,
  ) {}

  async listForUser(userId: string, limit = 30): Promise<MatchSummary[]> {
    const rows = await this.history.listForUser(userId, Math.min(Math.max(limit, 1), 100));
    const names = await this.namesOf(rows);
    return rows.map((row) => this.withNames(row, names));
  }

  async getFinished(matchId: string): Promise<MatchDetail> {
    const row = await this.history.getMatch(matchId);
    if (!row) throw new HubError('match.not_found');
    // A running match's moves and seed could leak hidden information or help a player cheat.
    if (row.status !== 'finished') throw new HubError('match.not_finished');
    const names = await this.namesOf([row]);
    return { ...row, ...this.withNames(row, names) };
  }

  private async namesOf(rows: StoredMatchSummary[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.flatMap((r) => r.players.flatMap((p) => (p.userId ? [p.userId] : []))))];
    const users = await this.users.findManyByIds(ids);
    return new Map(users.map((u) => [u.id, u.displayName]));
  }

  private withNames(row: StoredMatchSummary, names: Map<string, string>): MatchSummary {
    return {
      id: row.id,
      roomCode: row.roomCode,
      gameId: row.gameId,
      status: row.status,
      result: row.result,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      players: row.players.map((p) => ({ ...p, name: p.userId ? (names.get(p.userId) ?? null) : null })),
    };
  }
}
