import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { ChatMessage } from '@bg/protocol';
import type { MatchRecord, QueueEntry, Room } from '../domain/types';
import type { LiveStore } from './live-store';

const DAY_S = 24 * 60 * 60;
const LOCK_TTL_MS = 5_000;
const LOCK_WAIT_MS = 5_000;
const RELEASE_LOCK = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/** Live rooms and matches in Redis, shared by every server process (docs/06 §2). */
export class RedisLiveStore implements LiveStore {
  constructor(private readonly redis: Redis) {}

  async getRoom(id: string) {
    return this.getJson<Room>(`room:${id}`);
  }

  async saveRoom(room: Room) {
    await this.redis
      .multi()
      .set(`room:${room.id}`, JSON.stringify(room), 'EX', DAY_S)
      .set(`room:code:${room.code}`, room.id, 'EX', DAY_S)
      .exec();
  }

  async roomIdByCode(code: string) {
    return this.redis.get(`room:code:${code}`);
  }

  async getMatch(id: string) {
    return this.getJson<MatchRecord>(`match:${id}`);
  }

  async saveMatch(match: MatchRecord) {
    await this.redis.set(`match:${match.id}`, JSON.stringify(match), 'EX', DAY_S);
  }

  async appendChat(message: ChatMessage, keep: number) {
    const key = `chat:${message.roomId}`;
    await this.redis
      .multi()
      .rpush(key, JSON.stringify(message))
      .ltrim(key, -keep, -1)
      .expire(key, DAY_S)
      .exec();
  }

  async getChat(roomId: string) {
    const items = await this.redis.lrange(`chat:${roomId}`, 0, -1);
    return items.map((s) => JSON.parse(s) as ChatMessage);
  }

  async queuePut(bucket: string, entry: QueueEntry) {
    await this.queueRemove(entry.userId);
    await this.redis
      .multi()
      .hset(`queue:${bucket}`, entry.userId, JSON.stringify(entry))
      .sadd('queue:buckets', bucket)
      .set(`queue:user:${entry.userId}`, bucket, 'EX', DAY_S)
      .exec();
  }

  async queueRemove(userId: string) {
    const bucket = await this.redis.get(`queue:user:${userId}`);
    if (!bucket) return null;
    await this.redis.multi().hdel(`queue:${bucket}`, userId).del(`queue:user:${userId}`).exec();
    if ((await this.redis.hlen(`queue:${bucket}`)) === 0) await this.redis.srem('queue:buckets', bucket);
    return bucket;
  }

  async queueEntries(bucket: string) {
    const all = await this.redis.hvals(`queue:${bucket}`);
    return all.map((s) => JSON.parse(s) as QueueEntry);
  }

  async queueBuckets() {
    return this.redis.smembers('queue:buckets');
  }

  async setLive(roomId: string, live: boolean) {
    if (live) await this.redis.sadd('rooms:live', roomId);
    else await this.redis.srem('rooms:live', roomId);
  }

  async liveRoomIds() {
    return this.redis.smembers('rooms:live');
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${key}`;
    const token = randomUUID();
    const giveUpAt = Date.now() + LOCK_WAIT_MS;
    while ((await this.redis.set(lockKey, token, 'PX', LOCK_TTL_MS, 'NX')) !== 'OK') {
      if (Date.now() > giveUpAt) throw new Error(`could not lock ${key}`);
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 15));
    }
    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_LOCK, 1, lockKey, token);
    }
  }

  async close() {
    await this.redis.quit();
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
}
