import { z } from 'zod';

/** Bump on breaking changes; the server rejects other versions (docs/05 §7). */
export const PROTOCOL_VERSION = 1;

export const BotLevelSchema = z.enum(['easy', 'medium', 'hard']);
export type BotLevel = z.infer<typeof BotLevelSchema>;

export const TimeControlSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('none') }),
  /** Total time per player plus an increment after each move. */
  z.strictObject({
    type: z.literal('fischer'),
    baseMs: z.number().int().min(10_000).max(3_600_000),
    incrementMs: z.number().int().min(0).max(60_000),
  }),
  /** A fixed amount of time for every move. */
  z.strictObject({ type: z.literal('per-move'), moveMs: z.number().int().min(5_000).max(86_400_000) }),
]);
export type TimeControl = z.infer<typeof TimeControlSchema>;

export const TIME_CONTROL_PRESETS = {
  none: { type: 'none' },
  blitz: { type: 'fischer', baseMs: 3 * 60_000, incrementMs: 2_000 },
  rapid: { type: 'fischer', baseMs: 10 * 60_000, incrementMs: 5_000 },
  perMove30: { type: 'per-move', moveMs: 30_000 },
} as const satisfies Record<string, TimeControl>;
export type TimeControlPreset = keyof typeof TIME_CONTROL_PRESETS;

/** What happens to a seat whose player stays disconnected after the grace period (FR-ROOM-04). */
export const DisconnectPolicySchema = z.enum(['forfeit', 'bot']);
export type DisconnectPolicy = z.infer<typeof DisconnectPolicySchema>;

const Id = z.string().min(1).max(64);
const RoomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);

// ---------- Client → server payloads ----------

export const RoomCreate = z.strictObject({
  gameId: Id,
  config: z.unknown().optional(),
  timeControl: TimeControlSchema.default({ type: 'none' }),
  disconnectPolicy: DisconnectPolicySchema.default('forfeit'),
  /** Seat the host takes; null = watch only. */
  hostSeat: z.number().int().min(0).max(7).nullable().default(0),
});
export const RoomJoin = z.strictObject({ code: RoomCode });
export const RoomRef = z.strictObject({ roomId: Id });
export const RoomTakeSeat = z.strictObject({ roomId: Id, seat: z.number().int().min(0).max(7).nullable() });
export const RoomSetReady = z.strictObject({ roomId: Id, ready: z.boolean() });
export const RoomAddBot = z.strictObject({
  roomId: Id,
  seat: z.number().int().min(0).max(7),
  level: BotLevelSchema,
});
export const RoomRemoveBot = z.strictObject({ roomId: Id, seat: z.number().int().min(0).max(7) });
export const MoveSubmit = z.strictObject({
  matchId: Id,
  /** The seq the client is looking at; must equal the server's (docs/05 §1). */
  seq: z.number().int().min(0),
  /** Client-generated id, so a resent move is not applied twice. */
  clientMoveId: z.string().min(8).max(64),
  move: z.unknown(),
});
export const MatchActionName = z.enum(['resign', 'offer-draw', 'accept-draw', 'decline-draw']);
export const MatchAction = z.strictObject({ matchId: Id, action: MatchActionName });
export const MatchRef = z.strictObject({ matchId: Id });
export const ChatSend = z.strictObject({ roomId: Id, text: z.string().trim().min(1).max(300) });

export type RoomCreatePayload = z.input<typeof RoomCreate>;
export type MoveSubmitPayload = z.input<typeof MoveSubmit>;
export type MatchActionType = z.infer<typeof MatchActionName>;

// ---------- Server → client data ----------

export type SeatOccupant =
  | {
      kind: 'user';
      userId: string;
      name: string;
      ready: boolean;
      connected: boolean;
      /** When a disconnected player loses the seat (ms since epoch), else null. */
      graceUntil: number | null;
    }
  | { kind: 'bot'; level: BotLevel };

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomSnapshot {
  id: string;
  code: string;
  gameId: string;
  config: Record<string, unknown>;
  timeControl: TimeControl;
  disconnectPolicy: DisconnectPolicy;
  hostId: string;
  status: RoomStatus;
  seats: (SeatOccupant | null)[];
  spectatorCount: number;
  matchId: string | null;
}

export interface ClockView {
  seat: number;
  remainingMs: number;
  running: boolean;
}

export type GameResultView =
  { kind: 'win'; winners: number[]; reason: string } | { kind: 'draw'; reason: string };

export interface MatchSnapshot {
  matchId: string;
  roomId: string;
  gameId: string;
  rulesVersion: number;
  seq: number;
  moveCount: number;
  /** playerView for the receiver. Never the full state for hidden-info games. */
  view: unknown;
  /** Seat of the receiver, null for spectators. */
  mySeat: number | null;
  activeSeats: number[];
  clocks: ClockView[] | null;
  /** Server time when this snapshot was made, to run clocks on the client. */
  serverTime: number;
  result: GameResultView | null;
  pendingOffer: { type: 'draw'; from: number } | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  from: { userId: string; name: string };
  text: string;
  at: number;
}

export type Ack<T = Record<string, never>> =
  { ok: true; data: T } | { ok: false; code: string; params?: Record<string, unknown> };

/** Error codes shared by server and client (docs/05 §6). */
export const ERROR_CODES = [
  'auth.required',
  'protocol.version',
  'rate.limited',
  'invalid.payload',
  'internal',
  'room.not_found',
  'room.full',
  'room.not_host',
  'room.invalid_state',
  'room.seat_taken',
  'room.not_seated',
  'room.not_ready',
  'game.not_found',
  'match.not_found',
  'match.stale_seq',
  'match.not_player',
  'match.no_offer',
  'match.not_finished',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
