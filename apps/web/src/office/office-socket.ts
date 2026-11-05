'use client';

import { io, type Socket } from 'socket.io-client';
import {
  OFFICE_NAMESPACE,
  PROTOCOL_VERSION,
  type Ack,
  type HandshakeAuth,
  type OfficeClientToServerEvents,
  type OfficeServerToClientEvents,
} from '@bg/protocol';
import { serverUrl } from '@/online/api';
import { ensureToken, useSession } from '@/online/session';

export type OfficeSocket = Socket<OfficeServerToClientEvents, OfficeClientToServerEvents>;

let socket: OfficeSocket | null = null;
let socketToken: string | null = null;

/** One shared connection to the "/office" namespace per token (same rules as the board game socket). */
export async function getOfficeSocket(): Promise<OfficeSocket> {
  const token = await ensureToken();
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  const s: OfficeSocket = io(serverUrl() + OFFICE_NAMESPACE, {
    auth: { token, protocolVersion: PROTOCOL_VERSION } satisfies HandshakeAuth,
    transports: ['websocket', 'polling'],
  });
  s.on('connect_error', (err) => {
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

/** Emits with an ack and a timeout; failures come back as { ok: false, code }. */
export function officeRequest<R>(
  s: OfficeSocket,
  event: keyof OfficeClientToServerEvents,
  payload: unknown,
  timeoutMs = 10_000,
) {
  const timed = s.timeout(timeoutMs) as unknown as {
    emit(e: string, p: unknown, cb: (err: Error | null, res: Ack<R>) => void): void;
  };
  return new Promise<Ack<R>>((resolve) => {
    timed.emit(event, payload, (err, res) => resolve(err ? { ok: false, code: 'network' } : res));
  });
}
