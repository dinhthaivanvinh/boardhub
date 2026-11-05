import type { GameResult } from '@bg/engine';
import type { RatingChange, UserRating } from '@bg/protocol';
import { DEFAULT_RATING, isProvisional, rateGame, type Glicko } from './glicko2';

export interface StoredRating extends Glicko {
  userId: string;
  gameId: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface RatingRepo {
  /** The stored rating, or the default one for a player who has never played this game ranked. */
  get(userId: string, gameId: string): Promise<StoredRating>;
  save(rating: StoredRating): Promise<void>;
  /** Highest ratings first, only players with at least `minGames` ranked games. */
  top(gameId: string, limit: number, minGames: number): Promise<StoredRating[]>;
  forUser(userId: string): Promise<StoredRating[]>;
}

export const fresh = (userId: string, gameId: string): StoredRating => ({
  userId,
  gameId,
  ...DEFAULT_RATING,
  games: 0,
  wins: 0,
  losses: 0,
  draws: 0,
});

export class MemoryRatingRepo implements RatingRepo {
  private readonly rows = new Map<string, StoredRating>();
  private key = (userId: string, gameId: string) => `${userId}|${gameId}`;

  async get(userId: string, gameId: string) {
    return { ...(this.rows.get(this.key(userId, gameId)) ?? fresh(userId, gameId)) };
  }

  async save(rating: StoredRating) {
    this.rows.set(this.key(rating.userId, rating.gameId), { ...rating });
  }

  async top(gameId: string, limit: number, minGames: number) {
    return [...this.rows.values()]
      .filter((r) => r.gameId === gameId && r.games >= minGames)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  async forUser(userId: string) {
    return [...this.rows.values()].filter((r) => r.userId === userId).map((r) => ({ ...r }));
  }
}

export const toUserRating = (r: StoredRating): UserRating => ({
  gameId: r.gameId,
  rating: Math.round(r.rating),
  rd: Math.round(r.rd),
  provisional: isProvisional(r),
  games: r.games,
  wins: r.wins,
  losses: r.losses,
  draws: r.draws,
});

/** Ratings for ranked two-player games (docs/06, Glicko-2). */
export class RatingService {
  constructor(readonly repo: RatingRepo) {}

  async ratingOf(userId: string, gameId: string): Promise<number> {
    return Math.round((await this.repo.get(userId, gameId)).rating);
  }

  /** Updates both players after a ranked game. `players[i]` sits in seat i. Returns the changes, rounded. */
  async applyResult(gameId: string, players: [string, string], result: GameResult): Promise<RatingChange[]> {
    const [a, b] = await Promise.all(players.map((id) => this.repo.get(id, gameId)));
    if (!a || !b) return [];
    const scoreA = result.kind === 'draw' ? 0.5 : result.winners.includes(0) ? 1 : 0;
    const [nextA, nextB] = rateGame(a, b, scoreA);
    const tally = (r: StoredRating, next: Glicko, score: number): StoredRating => ({
      ...r,
      ...next,
      games: r.games + 1,
      wins: r.wins + (score === 1 ? 1 : 0),
      losses: r.losses + (score === 0 ? 1 : 0),
      draws: r.draws + (score === 0.5 ? 1 : 0),
    });
    await this.repo.save(tally(a, nextA, scoreA));
    await this.repo.save(tally(b, nextB, 1 - scoreA));
    return [
      { seat: 0, before: Math.round(a.rating), after: Math.round(nextA.rating) },
      { seat: 1, before: Math.round(b.rating), after: Math.round(nextB.rating) },
    ];
  }
}
