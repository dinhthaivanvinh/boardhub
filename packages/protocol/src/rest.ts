import type { GameResultView } from './schemas';
import { z } from 'zod';

const DisplayName = z.string().trim().min(2).max(24);

export const GuestRequest = z.strictObject({ displayName: DisplayName.optional() });
export const RegisterRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  displayName: DisplayName,
});
export const LoginRequest = z.strictObject({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const RenameRequest = z.strictObject({ displayName: DisplayName });

export type UserKind = 'guest' | 'registered';

export interface PublicUser {
  id: string;
  kind: UserKind;
  displayName: string;
  email: string | null;
  /** Can open /admin (server config ADMIN_EMAILS). */
  admin: boolean;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ApiError {
  code: string;
}

export interface MatchPlayerInfo {
  seat: number;
  userId: string | null;
  /** Display name for users, null for bots. */
  name: string | null;
  botLevel: string | null;
}

/** One row of a player's match history (GET /api/me/matches). */
export interface MatchSummary {
  id: string;
  roomCode: string;
  gameId: string;
  status: 'playing' | 'finished';
  result: GameResultView | null;
  startedAt: number;
  endedAt: number | null;
  players: MatchPlayerInfo[];
}

/** A finished match with everything needed to replay it (GET /api/matches/:id). */
export interface MatchDetail extends MatchSummary {
  rulesVersion: number;
  config: Record<string, unknown>;
  /** Revealed only once the match is over. */
  seed: string;
  moves: { seat: number; move: unknown }[];
}

export interface UserRating {
  gameId: string;
  rating: number;
  rd: number;
  /** Not enough games yet for the rating to be reliable. */
  provisional: boolean;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface LeaderboardEntry extends UserRating {
  rank: number;
  userId: string;
  name: string;
}

/** A public game being played now (GET /api/live). */
export interface LiveRoom {
  roomId: string;
  code: string;
  gameId: string;
  ranked: boolean;
  startedAt: number;
  spectatorCount: number;
  players: { seat: number; name: string; rating: number | null }[];
}
