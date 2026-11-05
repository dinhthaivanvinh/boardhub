import type { ChatMessage } from '@bg/protocol';
import type { MatchRecord, QueueEntry, Room } from '../domain/types';

/** Rooms and matches being played. Redis in production, memory in dev and tests (docs/06 §2). */
export interface LiveStore {
  getRoom(id: string): Promise<Room | null>;
  /** Also indexes the room code. */
  saveRoom(room: Room): Promise<void>;
  roomIdByCode(code: string): Promise<string | null>;
  getMatch(id: string): Promise<MatchRecord | null>;
  saveMatch(match: MatchRecord): Promise<void>;
  appendChat(message: ChatMessage, keep: number): Promise<void>;
  /** Oldest first. */
  getChat(roomId: string): Promise<ChatMessage[]>;
  /** Quick-match queue. A user is in at most one bucket; putting them in another moves them. */
  queuePut(bucket: string, entry: QueueEntry): Promise<void>;
  /** Removes the user from whatever bucket they are in; returns that bucket. */
  queueRemove(userId: string): Promise<string | null>;
  queueEntries(bucket: string): Promise<QueueEntry[]>;
  /** Buckets that have at least one entry. */
  queueBuckets(): Promise<string[]>;
  /** Index of public rooms with a match in progress. */
  setLive(roomId: string, live: boolean): Promise<void>;
  liveRoomIds(): Promise<string[]>;
  /** Runs fn while holding an exclusive lock on key (across server processes for Redis). */
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** In-process store. Values are cloned on the way in and out, like a real serialising store. */
export class MemoryLiveStore implements LiveStore {
  private rooms = new Map<string, Room>();
  private codes = new Map<string, string>();
  private matches = new Map<string, MatchRecord>();
  private chats = new Map<string, ChatMessage[]>();
  private locks = new Map<string, Promise<unknown>>();
  private queues = new Map<string, Map<string, QueueEntry>>();
  private queueOfUser = new Map<string, string>();
  private live = new Set<string>();

  async queuePut(bucket: string, entry: QueueEntry) {
    await this.queueRemove(entry.userId);
    const q = this.queues.get(bucket) ?? new Map<string, QueueEntry>();
    q.set(entry.userId, structuredClone(entry));
    this.queues.set(bucket, q);
    this.queueOfUser.set(entry.userId, bucket);
  }

  async queueRemove(userId: string) {
    const bucket = this.queueOfUser.get(userId) ?? null;
    if (bucket) {
      this.queues.get(bucket)?.delete(userId);
      if (this.queues.get(bucket)?.size === 0) this.queues.delete(bucket);
      this.queueOfUser.delete(userId);
    }
    return bucket;
  }

  async queueEntries(bucket: string) {
    return [...(this.queues.get(bucket)?.values() ?? [])].map((e) => structuredClone(e));
  }

  async queueBuckets() {
    return [...this.queues.keys()];
  }

  async setLive(roomId: string, live: boolean) {
    if (live) this.live.add(roomId);
    else this.live.delete(roomId);
  }

  async liveRoomIds() {
    return [...this.live];
  }

  async getRoom(id: string) {
    const room = this.rooms.get(id);
    return room ? structuredClone(room) : null;
  }

  async saveRoom(room: Room) {
    this.rooms.set(room.id, structuredClone(room));
    this.codes.set(room.code, room.id);
  }

  async roomIdByCode(code: string) {
    return this.codes.get(code) ?? null;
  }

  async getMatch(id: string) {
    const match = this.matches.get(id);
    return match ? structuredClone(match) : null;
  }

  async saveMatch(match: MatchRecord) {
    this.matches.set(match.id, structuredClone(match));
  }

  async appendChat(message: ChatMessage, keep: number) {
    const list = [...(this.chats.get(message.roomId) ?? []), message].slice(-keep);
    this.chats.set(message.roomId, list);
  }

  async getChat(roomId: string) {
    return structuredClone(this.chats.get(roomId) ?? []);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    // Keep the chain going even if fn fails; drop it when nothing else is queued.
    const tail = run.catch(() => undefined);
    this.locks.set(key, tail);
    void tail.then(() => {
      if (this.locks.get(key) === tail) this.locks.delete(key);
    });
    return run;
  }

  async close() {}
}
