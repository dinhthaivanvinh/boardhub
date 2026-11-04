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
  update(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): Promise<UserRecord | null>;
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
  players: { seat: number; userId: string | null; botLevel: string | null }[];
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
}

export class MemoryUserRepo implements UserRepo {
  readonly users = new Map<string, UserRecord>();

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
}
