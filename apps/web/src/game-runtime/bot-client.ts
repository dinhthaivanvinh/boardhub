import { computeBotMove, type BotRequest } from './bot-compute';

type Pending = { resolve: (move: unknown) => void; reject: (err: Error) => void };
type Reply = { id: number; ok: true; move: unknown } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data;
    const p = pending.get(reply.id);
    if (!p) return;
    pending.delete(reply.id);
    if (reply.ok) p.resolve(reply.move);
    else p.reject(new Error(reply.error));
  };
  worker.onerror = (event) => {
    for (const p of pending.values()) p.reject(new Error(event.message || 'bot worker crashed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Asks the bot for a move in a Web Worker, or on the main thread if workers are unavailable. */
export function requestBotMove(req: BotRequest): Promise<unknown> {
  const w = getWorker();
  if (!w) {
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(computeBotMove(req));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }, 0),
    );
  }
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, ...req });
  });
}
