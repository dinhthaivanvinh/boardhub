import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import {
  ChatSend,
  QueueJoin,
  QueueLeave,
  MatchAction,
  MatchRef,
  MoveSubmit,
  PROTOCOL_VERSION,
  RoomAddBot,
  RoomCreate,
  RoomJoin,
  RoomRef,
  RoomRemoveBot,
  RoomSetReady,
  RoomTakeSeat,
  type Ack,
  type ClientToServerEvents,
  type HandshakeAuth,
  type ServerToClientEvents,
} from '@bg/protocol';
import type { AuthService } from '../auth/auth-service';
import type { Actor } from '../domain/types';
import { HubError } from '../errors';
import type { GameHub, Logger, Notifier } from '../hub/game-hub';
import type { Matchmaker } from '../matchmaking/matchmaker';
import { RateLimiter } from './rate-limit';

interface SocketData {
  actor: Actor;
}

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomChannel = (roomId: string) => `room:${roomId}`;
const userChannel = (userId: string) => `user:${userId}`;

/** Pushes hub changes to sockets. Each player gets only their own view of the match (NFR-06). */
export function createNotifier(io: IoServer): Notifier {
  return {
    roomUpdated(room) {
      io.to(roomChannel(room.id)).emit('room:updated', room);
    },
    matchUpdated({ roomId, perUser, spectators }) {
      for (const { userId, snapshot } of perUser) io.to(userChannel(userId)).emit('match:state', snapshot);
      io.to(roomChannel(roomId))
        .except(perUser.map((p) => userChannel(p.userId)))
        .emit('match:state', spectators);
    },
    chatMessage(message) {
      io.to(roomChannel(message.roomId)).emit('chat:message', message);
    },
  };
}

export function attachGateway(
  io: IoServer,
  hub: GameHub,
  auth: AuthService,
  log: Logger,
  matchmaker?: Matchmaker,
) {
  io.use(async (socket, next) => {
    const { token, protocolVersion } = (socket.handshake.auth ?? {}) as Partial<HandshakeAuth>;
    if (protocolVersion !== PROTOCOL_VERSION) return next(new Error('protocol.version'));
    const user = await auth.authenticate(token).catch(() => null);
    if (!user) return next(new Error('auth.required'));
    socket.data.actor = { userId: user.id, name: user.displayName };
    next();
  });

  io.on('connection', (socket: IoSocket) => {
    const { actor } = socket.data;
    void socket.join(userChannel(actor.userId));
    const limiter = new RateLimiter();

    /** Validates the payload, rate-limits, runs the handler and always answers through the ack. */
    const on = <S extends z.ZodType, R>(
      event: keyof ClientToServerEvents,
      schema: S,
      handler: (input: z.output<S>) => Promise<R>,
    ) => {
      socket.on(event, async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const reply = ack as (res: Ack<R | Record<string, never>>) => void;
        if (!limiter.allow()) return reply({ ok: false, code: 'rate.limited' });
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, code: 'invalid.payload' });
        try {
          const data = await handler(parsed.data);
          reply({ ok: true, data: data ?? {} });
        } catch (err) {
          if (err instanceof HubError)
            return reply({ ok: false, code: err.code, ...(err.params ? { params: err.params } : {}) });
          log.error({ err, event, userId: actor.userId }, 'handler failed');
          reply({ ok: false, code: 'internal' });
        }
      });
    };

    on('room:create', RoomCreate, async (input) => {
      const room = await hub.createRoom(actor, input);
      await socket.join(roomChannel(room.id));
      return { room };
    });
    on('room:join', RoomJoin, async ({ code }) => {
      const joined = await hub.joinRoom(actor, code);
      await socket.join(roomChannel(joined.room.id));
      return joined;
    });
    on('room:leave', RoomRef, async ({ roomId }) => {
      await socket.leave(roomChannel(roomId));
      await hub.leaveRoom(actor, roomId);
    });
    on('room:take-seat', RoomTakeSeat, ({ roomId, seat }) => hub.takeSeat(actor, roomId, seat));
    on('room:set-ready', RoomSetReady, ({ roomId, ready }) => hub.setReady(actor, roomId, ready));
    on('room:add-bot', RoomAddBot, ({ roomId, seat, level }) => hub.addBot(actor, roomId, seat, level));
    on('room:remove-bot', RoomRemoveBot, ({ roomId, seat }) => hub.removeBot(actor, roomId, seat));
    on('room:start', RoomRef, ({ roomId }) => hub.startMatch(actor, roomId));
    on('room:rematch', RoomRef, ({ roomId }) => hub.rematch(actor, roomId));
    on('move:submit', MoveSubmit, (input) => hub.submitMove(actor, input));
    on('match:action', MatchAction, ({ matchId, action }) => hub.matchAction(actor, matchId, action));
    on('match:resync', MatchRef, async ({ matchId }) => ({ match: await hub.resync(actor, matchId) }));
    on('chat:send', ChatSend, ({ roomId, text }) => hub.chat(actor, roomId, text));
    on('queue:join', QueueJoin, async (input) => {
      if (!matchmaker) throw new HubError('queue.unsupported');
      await matchmaker.join(actor, input);
    });
    on('queue:leave', QueueLeave, async () => matchmaker?.leave(actor.userId));

    // When the user's last socket in a room goes away, start their grace period.
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((r) => r.startsWith('room:'));
      void (async () => {
        const others = await io.in(userChannel(actor.userId)).fetchSockets();
        for (const channel of rooms) {
          const stillThere = others.some((s) => s.id !== socket.id && s.rooms.has(channel));
          if (!stillThere) await hub.disconnected(actor.userId, channel.slice('room:'.length));
        }
        // Closing the last tab also leaves the quick-match queue.
        if (!others.some((s) => s.id !== socket.id)) await matchmaker?.leave(actor.userId);
      })().catch((err: unknown) => log.error({ err, userId: actor.userId }, 'disconnect handling failed'));
    });
  });
}
