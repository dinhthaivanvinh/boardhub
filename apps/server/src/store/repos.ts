import type { GameResult } from '@bg/engine';
import type { TimeControl, UserKind } from '@bg/protocol';

export interface UserRecord {
  id: string;
  kind: UserKind;
  displayName: string;
  email: string | null;
  passwordHash: string | null;
  createdAt: number;
}

export interface UserRepo {
  create(user: Omit<UserRecord, 'createdAt'>): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findManyByIds(ids: string[]): Promise<UserRecord[]>;
  update(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): Promise<UserRecord | null>;
  /** The user's office avatar as stored (callers validate it), or null. */
  getAvatar(id: string): Promise<unknown>;
  /** Returns false if the user does not exist. */
  setAvatar(id: string, avatar: unknown): Promise<boolean>;
}

export interface NewMatchRow {
  id: string;
  roomCode: string;
  gameId: string;
  rulesVersion: number;
  config: Record<string, unknown>;
  timeControl: TimeControl;
  seed: string;
  startedAt: number;
  ranked: boolean;
  players: { seat: number; userId: string | null; botLevel: string | null }[];
}

export interface StoredMatchSummary {
  id: string;
  roomCode: string;
  gameId: string;
  status: 'playing' | 'finished';
  result: GameResult | null;
  startedAt: number;
  endedAt: number | null;
  players: { seat: number; userId: string | null; botLevel: string | null }[];
}

export interface StoredMatch extends StoredMatchSummary {
  rulesVersion: number;
  config: Record<string, unknown>;
  seed: string;
  moves: { seat: number; move: unknown }[];
}

/** Finished and running matches kept forever (docs/06 §1). */
export interface HistoryRepo {
  createMatch(match: NewMatchRow): Promise<void>;
  addMove(
    matchId: string,
    index: number,
    seat: number,
    move: unknown,
    elapsedMs: number,
    at: number,
  ): Promise<void>;
  finishMatch(matchId: string, result: GameResult, endedAt: number): Promise<void>;
  setRatingChanges(
    matchId: string,
    changes: { seat: number; before: number; after: number }[],
  ): Promise<void>;
  /** Matches the user played in, newest first. */
  listForUser(userId: string, limit: number): Promise<StoredMatchSummary[]>;
  getMatch(id: string): Promise<StoredMatch | null>;
}

export class MemoryUserRepo implements UserRepo {
  readonly users = new Map<string, UserRecord>();
  readonly avatars = new Map<string, unknown>();

  async getAvatar(id: string) {
    return this.avatars.get(id) ?? null;
  }

  async setAvatar(id: string, avatar: unknown) {
    if (!this.users.has(id)) return false;
    this.avatars.set(id, structuredClone(avatar));
    return true;
  }

  async create(user: Omit<UserRecord, 'createdAt'>) {
    if (user.email && (await this.findByEmail(user.email))) throw new Error('duplicate email');
    const record = { ...user, createdAt: Date.now() };
    this.users.set(user.id, record);
    return { ...record };
  }

  async findById(id: string) {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async findByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === email) return { ...u };
    return null;
  }

  async findManyByIds(ids: string[]) {
    return ids.flatMap((id) => {
      const u = this.users.get(id);
      return u ? [{ ...u }] : [];
    });
  }

  async update(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>) {
    const u = this.users.get(id);
    if (!u) return null;
    const next = { ...u, ...patch };
    this.users.set(id, next);
    return { ...next };
  }
}

export interface MemoryMatchRow extends NewMatchRow {
  moves: { index: number; seat: number; move: unknown; elapsedMs: number }[];
  ratingChanges?: { seat: number; before: number; after: number }[];
  result: GameResult | null;
  endedAt: number | null;
}

export class MemoryHistoryRepo implements HistoryRepo {
  readonly matches = new Map<string, MemoryMatchRow>();

  async createMatch(match: NewMatchRow) {
    this.matches.set(match.id, { ...structuredClone(match), moves: [], result: null, endedAt: null });
  }

  async addMove(matchId: string, index: number, seat: number, move: unknown, elapsedMs: number) {
    this.matches.get(matchId)?.moves.push({ index, seat, move: structuredClone(move), elapsedMs });
  }

  async finishMatch(matchId: string, result: GameResult, endedAt: number) {
    const m = this.matches.get(matchId);
    if (m) Object.assign(m, { result, endedAt });
  }

  async setRatingChanges(matchId: string, changes: { seat: number; before: number; after: number }[]) {
    const m = this.matches.get(matchId);
    if (m) m.ratingChanges = structuredClone(changes);
  }

  async listForUser(userId: string, limit: number): Promise<StoredMatchSummary[]> {
    return [...this.matches.values()]
      .filter((m) => m.players.some((p) => p.userId === userId))
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
      .map((m) => this.summary(m));
  }

  async getMatch(id: string): Promise<StoredMatch | null> {
    const m = this.matches.get(id);
    if (!m) return null;
    return {
      ...this.summary(m),
      rulesVersion: m.rulesVersion,
      config: structuredClone(m.config),
      seed: m.seed,
      moves: [...m.moves]
        .sort((a, b) => a.index - b.index)
        .map(({ seat, move }) => ({ seat, move: structuredClone(move) })),
    };
  }

  private summary(m: MemoryMatchRow): StoredMatchSummary {
    return {
      id: m.id,
      roomCode: m.roomCode,
      gameId: m.gameId,
      status: m.endedAt === null ? 'playing' : 'finished',
      result: m.result,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      players: structuredClone(m.players),
    };
  }
}
