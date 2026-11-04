import type { GameResult, Seat } from '@bg/engine';
import type { DisconnectPolicy, RoomStatus, SeatOccupant, TimeControl } from '@bg/protocol';

export interface Actor {
  userId: string;
  name: string;
}

/** A room as stored in the live store (Redis or memory). */
export interface Room {
  id: string;
  code: string;
  gameId: string;
  config: Record<string, unknown>;
  timeControl: TimeControl;
  disconnectPolicy: DisconnectPolicy;
  hostId: string;
  status: RoomStatus;
  /** Length = the game's maxPlayers. Seats 0..n-1 play; there must be no gaps. */
  seats: (SeatOccupant | null)[];
  /** User ids watching without a seat. */
  spectators: string[];
  /** Current match, or the last one while status is 'finished'. */
  matchId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Clocks {
  remainingMs: number[];
  /** Seat whose clock runs, null when stopped. */
  runningSeat: Seat | null;
  turnStartedAt: number;
}

export interface MatchRecord {
  id: string;
  roomId: string;
  gameId: string;
  rulesVersion: number;
  config: Record<string, unknown>;
  /** Kept secret until the match ends (docs/03 §8). */
  seed: string;
  players: number;
  state: unknown;
  /** Increases on every change the client must see (docs/05 §1). */
  seq: number;
  moves: { seat: Seat; move: unknown; at: number }[];
  clocks: Clocks | null;
  /** Recent clientMoveIds, so a resent move is not applied twice. */
  processedMoveIds: string[];
  result: GameResult | null;
  pendingOffer: { type: 'draw'; from: Seat } | null;
  startedAt: number;
  lastMoveAt: number;
}

export type UserOccupant = Extract<SeatOccupant, { kind: 'user' }>;
