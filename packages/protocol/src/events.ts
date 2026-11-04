import type { z } from 'zod';
import type {
  Ack,
  ChatMessage,
  ChatSend,
  MatchAction,
  MatchRef,
  MatchSnapshot,
  MoveSubmit,
  RoomAddBot,
  RoomCreate,
  RoomJoin,
  RoomRef,
  RoomRemoveBot,
  RoomSetReady,
  RoomSnapshot,
  RoomTakeSeat,
} from './schemas';

type Handler<P, R = Record<string, never>> = (payload: z.input<P>, ack: (res: Ack<R>) => void) => void;

export interface RoomJoined {
  room: RoomSnapshot;
  match: MatchSnapshot | null;
  chat: ChatMessage[];
}

/** Events the browser sends. Every payload is validated with the schema of the same name. */
export interface ClientToServerEvents {
  'room:create': Handler<typeof RoomCreate, { room: RoomSnapshot }>;
  'room:join': Handler<typeof RoomJoin, RoomJoined>;
  'room:leave': Handler<typeof RoomRef>;
  'room:take-seat': Handler<typeof RoomTakeSeat>;
  'room:set-ready': Handler<typeof RoomSetReady>;
  'room:add-bot': Handler<typeof RoomAddBot>;
  'room:remove-bot': Handler<typeof RoomRemoveBot>;
  'room:start': Handler<typeof RoomRef>;
  'room:rematch': Handler<typeof RoomRef>;
  'move:submit': Handler<typeof MoveSubmit, { seq: number }>;
  'match:action': Handler<typeof MatchAction>;
  'match:resync': Handler<typeof MatchRef, { match: MatchSnapshot }>;
  'chat:send': Handler<typeof ChatSend>;
}

/** Events the server pushes. */
export interface ServerToClientEvents {
  'room:updated': (room: RoomSnapshot) => void;
  /** Sent separately to each player with their own view. */
  'match:state': (match: MatchSnapshot) => void;
  'chat:message': (message: ChatMessage) => void;
}

/** Sent in the Socket.IO handshake `auth` field. */
export interface HandshakeAuth {
  token: string;
  protocolVersion: number;
}
