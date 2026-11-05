import { z } from 'zod';
import { AvatarSchema, type Avatar } from '@bg/avatars/schema';
import type { Ack } from './schemas';

/** Office area: Socket.IO namespace "/office" (docs/office/06-protocol-and-data.md). */
export const OFFICE_NAMESPACE = '/office';
export const OFFICE_MAX_PARTICIPANTS = 200;

export const OfficeCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);
const Name = z.string().trim().min(1).max(24);
const Id = z.string().min(1).max(80);
export const ScreenSchema = z.enum(['host', 'stage', 'participant']);
export type OfficeScreen = z.infer<typeof ScreenSchema>;

// ---------- Client → server ----------

export const OfficeCreate = z.strictObject({
  activityId: z.string().min(1).max(40),
  title: z.string().trim().max(60).default(''),
  settings: z.record(z.string(), z.unknown()).default({}),
});
export const OfficeJoin = z.strictObject({
  code: OfficeCode,
  screen: ScreenSchema,
  name: Name.optional(),
  avatar: AvatarSchema.optional(),
});
export const OfficeRef = z.strictObject({ code: OfficeCode });
export const OfficeUpdateMe = z.strictObject({
  code: OfficeCode,
  name: Name.optional(),
  avatar: AvatarSchema.optional(),
});
export const OfficeHostOp = z.discriminatedUnion('op', [
  z.strictObject({ code: OfficeCode, op: z.literal('lock') }),
  z.strictObject({ code: OfficeCode, op: z.literal('unlock') }),
  z.strictObject({ code: OfficeCode, op: z.literal('close') }),
  z.strictObject({ code: OfficeCode, op: z.literal('kick'), id: Id }),
  z.strictObject({ code: OfficeCode, op: z.literal('rename'), id: Id, name: Name }),
  z.strictObject({ code: OfficeCode, op: z.literal('add-absent'), name: Name, avatar: AvatarSchema }),
  z.strictObject({ code: OfficeCode, op: z.literal('transfer'), id: Id }),
]);
export const OfficeAction = z.strictObject({ code: OfficeCode, action: z.unknown() });
/** Emoji people can send from their phone (docs/office/07 §6). */
export const OFFICE_REACTIONS = ['👏', '😂', '😮', '🎉', '❤️', '🙈'] as const;
export type OfficeReactionEmoji = (typeof OFFICE_REACTIONS)[number];
export const OfficeReact = z.strictObject({ code: OfficeCode, emoji: z.enum(OFFICE_REACTIONS) });

// ---------- Server → client ----------

export interface OfficeParticipant {
  id: string;
  name: string;
  avatar: Avatar;
  online: boolean;
  joinedAt: number;
  absent: boolean;
}

export type OfficeStatus = 'open' | 'locked' | 'closed';

export interface OfficeSessionInfo {
  code: string;
  activityId: string;
  title: string;
  status: OfficeStatus;
  hostId: string;
}

/** Someone in a draw, as they were when the draw started (so history does not change later). */
export interface OfficeDrawCandidate {
  id: string;
  name: string;
  avatar: Avatar;
}

/** A draw that has started: the result is fixed but secret; only its commitment is public (ADR-0006). */
export interface OfficeDrawStarted {
  drawId: string;
  round: number;
  mode: string;
  n: number;
  /** Sorted by id: the exact pool the winners are drawn from. */
  candidates: OfficeDrawCandidate[];
  /** sha256(seed), hex. */
  commitment: string;
  /** Server times (ms): build-up runs from startsAt, landing from revealAt. */
  startsAt: number;
  revealAt: number;
}

/** A revealed draw: anyone can check it with verifyDraw (docs/office/04 §5). */
export interface OfficeDrawRecord extends OfficeDrawStarted {
  seed: string;
  winners: string[];
  revealedAt: number;
}

export interface OfficeSnapshot extends OfficeSessionInfo {
  seq: number;
  serverTime: number;
  me: { id: string; isHost: boolean; screen: OfficeScreen; joined: boolean };
  participants: OfficeParticipant[];
  /** The activity's view for your screen. */
  activity: unknown;
  /** The draw running now, or the last one (revealed), so late joiners can catch up. */
  draw: OfficeDrawStarted | OfficeDrawRecord | null;
  /** Revealed draws of this session, newest first (at most 50). */
  history: OfficeDrawRecord[];
}

export type OfficeHostOpInput = z.input<typeof OfficeHostOp>;

type Handler<P, R = Record<string, never>> = (payload: z.input<P>, ack: (res: Ack<R>) => void) => void;

export interface OfficeClientToServerEvents {
  'office:create': Handler<typeof OfficeCreate, { session: OfficeSnapshot }>;
  'office:join': Handler<typeof OfficeJoin, { session: OfficeSnapshot }>;
  'office:leave': Handler<typeof OfficeRef>;
  'office:update-me': Handler<typeof OfficeUpdateMe>;
  'office:host': Handler<typeof OfficeHostOp>;
  'office:action': Handler<typeof OfficeAction>;
  'office:resync': Handler<typeof OfficeRef, { session: OfficeSnapshot }>;
  /** Fire-and-forget: not stored, no `seq`; at most 3 per 2 seconds per socket. */
  'office:react': Handler<typeof OfficeReact>;
}

export interface OfficeServerToClientEvents {
  /** Someone joined, came back, went offline, or changed name/avatar. */
  'office:participant': (e: { code: string; seq: number; participant: OfficeParticipant }) => void;
  'office:participant-removed': (e: {
    code: string;
    seq: number;
    id: string;
    reason: 'left' | 'kicked';
  }) => void;
  'office:session': (e: { code: string; seq: number; session: OfficeSessionInfo }) => void;
  'office:activity': (e: { code: string; seq: number; view: unknown }) => void;
  'office:draw-started': (e: { code: string; seq: number; draw: OfficeDrawStarted }) => void;
  'office:draw-revealed': (e: { code: string; seq: number; draw: OfficeDrawRecord }) => void;
  /** Sent to the person who was removed by the host. */
  'office:kicked': (e: { code: string }) => void;
  /** A reaction from a participant, sent to the stage and host screens only. */
  'office:reaction': (e: { code: string; from: string; emoji: OfficeReactionEmoji }) => void;
}
