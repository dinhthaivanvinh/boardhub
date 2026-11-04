'use client';

import { io, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type Ack,
  type ClientToServerEvents,
  type HandshakeAuth,
  type ServerToClientEvents,
} from '@bg/protocol';
import { serverUrl } from './api';
import { ensureToken, useSession } from './session';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let socketToken: string | null = null;

/** One shared connection per token. Reconnects automatically; a rejected token is replaced by a new guest. */
export async function getSocket(): Promise<GameSocket> {
  const token = await ensureToken();
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  const s: GameSocket = io(serverUrl(), {
    auth: { token, protocolVersion: PROTOCOL_VERSION } satisfies HandshakeAuth,
    transports: ['websocket', 'polling'],
  });
  s.on('connect_error', (err) => {
    // The server forgot us (e.g. dev server restarted with in-memory users): start over as a new guest.
    if (err.message !== 'auth.required') return;
    useSession.getState().clear();
    void ensureToken().then((fresh) => {
      socketToken = fresh;
      (s.auth as HandshakeAuth).token = fresh;
      s.connect();
    });
  });
  socket = s;
  return s;
}

/** Emits with an ack and a timeout. Never throws: failures come back as { ok: false, code }. */
export function request<R>(
  s: GameSocket,
  event: keyof ClientToServerEvents,
  payload: unknown,
  timeoutMs = 10_000,
) {
  // The typed emit signature doesn't model timeout acks, hence the narrow cast.
  const timed = s.timeout(timeoutMs) as unknown as {
    emit(e: string, p: unknown, cb: (err: Error | null, res: Ack<R>) => void): void;
  };
  return new Promise<Ack<R>>((resolve) => {
    timed.emit(event, payload, (err, res) => resolve(err ? { ok: false, code: 'network' } : res));
  });
}
