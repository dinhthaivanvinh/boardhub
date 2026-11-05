import type { GameResult, RecordedMove } from '@bg/engine';
import type { BotLevel } from '@bg/bots';
import type { MatchDetail } from '@bg/protocol';
import type { SeatController } from './match-setup';

/**
 * Finished local and bot games, kept in this browser only (IndexedDB, never sent anywhere).
 * Same data as an online match: config + seed + moves are enough to rebuild every position.
 */
export interface LocalMatchRecord {
  id: string;
  gameId: string;
  rulesVersion: number;
  mode: 'bot' | 'local';
  config: Record<string, unknown>;
  seed: string;
  /** null = a person at this computer. */
  players: { seat: number; botLevel: BotLevel | null }[];
  moves: RecordedMove[];
  result: GameResult;
  startedAt: number;
  endedAt: number;
}

/** Oldest games are dropped beyond this many. */
export const LOCAL_HISTORY_LIMIT = 200;

const DB_NAME = 'bg-local';
const STORE = 'matches';

export function toLocalRecord(input: {
  id: string;
  gameId: string;
  rulesVersion: number;
  config: unknown;
  seed: string;
  controllers: readonly SeatController[];
  moves: RecordedMove[];
  result: GameResult;
  startedAt: number;
  endedAt: number;
}): LocalMatchRecord {
  const players = input.controllers.map((c, seat) => ({
    seat,
    botLevel: c.kind === 'bot' ? c.level : null,
  }));
  return {
    id: input.id,
    gameId: input.gameId,
    rulesVersion: input.rulesVersion,
    mode: players.some((p) => p.botLevel) ? 'bot' : 'local',
    config: structuredClone(input.config ?? {}) as Record<string, unknown>,
    seed: input.seed,
    players,
    moves: structuredClone(input.moves),
    result: structuredClone(input.result),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
}

/** The seat played by the person against the computer; null in hot-seat games. */
export function humanSeatOf(record: Pick<LocalMatchRecord, 'mode' | 'players'>): number | null {
  if (record.mode !== 'bot') return null;
  return record.players.find((p) => p.botLevel === null)?.seat ?? null;
}

/** Win / loss / draw from the person's side (bot games); hot-seat games have no side. */
export function localOutcome(record: LocalMatchRecord): 'win' | 'loss' | 'draw' | 'played' {
  if (record.result.kind === 'draw') return 'draw';
  const seat = humanSeatOf(record);
  if (seat === null) return 'played';
  return record.result.winners.includes(seat) ? 'win' : 'loss';
}

/** Shape the replay screen already understands. */
export function asMatchDetail(record: LocalMatchRecord): MatchDetail {
  return {
    id: record.id,
    roomCode: '',
    gameId: record.gameId,
    status: 'finished',
    result: record.result,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    players: record.players.map((p) => ({ seat: p.seat, userId: null, name: null, botLevel: p.botLevel })),
    rulesVersion: record.rulesVersion,
    config: record.config,
    seed: record.seed,
    moves: record.moves,
  };
}

/** Ids for local games: random, 32 hex digits. */
export function newLocalMatchId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
}

// ---------------------------------------------------------------- IndexedDB

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no indexedDB'));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('endedAt', 'endedAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  }).catch((err: unknown) => {
    opening = null;
    throw err;
  });
  return opening;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await open();
  const t = db.transaction(STORE, mode);
  const finished = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error('indexedDB transaction failed'));
    t.onabort = () => reject(t.error ?? new Error('indexedDB transaction aborted'));
  });
  const out = await fn(t.objectStore(STORE));
  await finished;
  return out;
}

/** Saves (or overwrites, e.g. after an undo) a finished game, then trims the oldest ones. */
export async function saveLocalMatch(record: LocalMatchRecord): Promise<void> {
  await tx('readwrite', async (store) => {
    await done(store.put(record));
    const keys = await done(store.index('endedAt').getAllKeys());
    // getAllKeys on the index is ordered by endedAt, oldest first.
    for (const key of keys.slice(0, Math.max(0, keys.length - LOCAL_HISTORY_LIMIT)))
      await done(store.delete(key));
  });
}

/** Newest first. Empty when IndexedDB is not available (private mode in some browsers). */
export async function listLocalMatches(): Promise<LocalMatchRecord[]> {
  try {
    const all = await tx('readonly', (store) => done(store.getAll() as IDBRequest<LocalMatchRecord[]>));
    return all.sort((a, b) => b.endedAt - a.endedAt);
  } catch {
    return [];
  }
}

export async function getLocalMatch(id: string): Promise<LocalMatchRecord | null> {
  try {
    const rec = await tx('readonly', (store) =>
      done(store.get(id) as IDBRequest<LocalMatchRecord | undefined>),
    );
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function clearLocalMatches(): Promise<void> {
  await tx('readwrite', (store) => done(store.clear()).then(() => undefined));
}
