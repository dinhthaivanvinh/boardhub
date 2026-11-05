import { randomInt } from 'node:crypto';
import type { AnyGameDefinition } from '@bg/engine';
import { TIME_CONTROL_PRESETS, type TimeControlPreset } from '@bg/protocol';
import type { Actor, QueueEntry } from '../domain/types';
import { HubError } from '../errors';
import type { GameHub, Logger } from '../hub/game-hub';
import type { RatingService } from '../ratings/rating-service';
import type { LiveStore } from '../store/live-store';

export interface QueueRequest {
  gameId: string;
  timeControl: TimeControlPreset;
  ranked: boolean;
}

export interface MatchmakerOptions {
  store: LiveStore;
  hub: GameHub;
  games: Record<string, AnyGameDefinition>;
  ratings?: RatingService;
  /** Tells a waiting player where their game is. */
  notify(userId: string, match: { roomId: string; roomCode: string }): void;
  log: Logger;
  now?: () => number;
  /** Shuffles who sits first; injectable for tests. */
  coinFlip?: () => boolean;
}

/** Ranked players are only paired within this many rating points; it widens the longer they wait. */
export function ratingWindow(waitedMs: number): number {
  return Math.min(600, 150 + 50 * Math.floor(waitedMs / 5_000));
}

const bucketOf = (r: QueueRequest) => `${r.gameId}|${r.timeControl}|${r.ranked ? 'ranked' : 'casual'}`;

function parseBucket(bucket: string): QueueRequest {
  const [gameId = '', timeControl = 'blitz', kind] = bucket.split('|');
  return { gameId, timeControl: timeControl as TimeControlPreset, ranked: kind === 'ranked' };
}

/**
 * Quick match (FR-ROOM-05): players wait in a bucket per game + time control + ranked/casual.
 * Oldest first; ranked players are paired with the closest rating inside both players' windows.
 * Each bucket is matched under a lock, so several server processes can run the matchmaker.
 */
export class Matchmaker {
  private readonly now: () => number;
  private readonly coinFlip: () => boolean;

  constructor(private readonly o: MatchmakerOptions) {
    this.now = o.now ?? Date.now;
    this.coinFlip = o.coinFlip ?? (() => randomInt(2) === 0);
  }

  async join(actor: Actor, request: QueueRequest): Promise<void> {
    const def = this.o.games[request.gameId];
    if (!def) throw new HubError('game.not_found');
    // Quick match pairs two people; games for more players need a room.
    if (def.meta.minPlayers !== 2) throw new HubError('queue.unsupported');
    const rating = this.o.ratings ? await this.o.ratings.ratingOf(actor.userId, request.gameId) : 1500;
    const entry: QueueEntry = { userId: actor.userId, name: actor.name, rating, joinedAt: this.now() };
    const bucket = bucketOf(request);
    await this.o.store.withLock(`queue:${bucket}`, () => this.o.store.queuePut(bucket, entry));
    await this.tryMatch(bucket);
  }

  async leave(userId: string): Promise<void> {
    await this.o.store.queueRemove(userId);
  }

  /** Re-tries every bucket; run periodically so widening rating windows eventually pair people. */
  async sweep(): Promise<void> {
    for (const bucket of await this.o.store.queueBuckets()) await this.tryMatch(bucket);
  }

  private async tryMatch(bucket: string): Promise<void> {
    const request = parseBucket(bucket);
    const pairs = await this.o.store.withLock(`queue:${bucket}`, async () => {
      const entries = (await this.o.store.queueEntries(bucket)).sort((a, b) => a.joinedAt - b.joinedAt);
      const now = this.now();
      const used = new Set<string>();
      const found: [QueueEntry, QueueEntry][] = [];
      for (const a of entries) {
        if (used.has(a.userId)) continue;
        let best: QueueEntry | null = null;
        for (const b of entries) {
          if (b.userId === a.userId || used.has(b.userId)) continue;
          const diff = Math.abs(a.rating - b.rating);
          if (request.ranked) {
            const allowed = Math.min(ratingWindow(now - a.joinedAt), ratingWindow(now - b.joinedAt));
            if (diff > allowed) continue;
          }
          if (!best || diff < Math.abs(a.rating - best.rating)) best = b;
        }
        if (best) {
          used.add(a.userId);
          used.add(best.userId);
          found.push([a, best]);
        }
      }
      for (const [a, b] of found) {
        await this.o.store.queueRemove(a.userId);
        await this.o.store.queueRemove(b.userId);
      }
      return found;
    });

    for (const [a, b] of pairs) {
      const seated = this.coinFlip() ? [a, b] : [b, a];
      try {
        const room = await this.o.hub.createMatchedRoom(
          seated.map((e) => ({ actor: { userId: e.userId, name: e.name }, rating: e.rating })),
          {
            gameId: request.gameId,
            timeControl: TIME_CONTROL_PRESETS[request.timeControl],
            ranked: request.ranked,
          },
        );
        for (const e of seated) this.o.notify(e.userId, { roomId: room.id, roomCode: room.code });
      } catch (err) {
        this.o.log.error({ err, bucket }, 'could not create a matched room');
      }
    }
  }
}
