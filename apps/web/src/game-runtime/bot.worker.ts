// Runs bots off the main thread so the UI stays smooth (rule B5).
import { computeBotMove, type BotRequest } from './bot-compute';

type Incoming = BotRequest & { id: number };

self.onmessage = (event: MessageEvent<Incoming>) => {
  const { id, ...req } = event.data;
  try {
    self.postMessage({ id, ok: true, move: computeBotMove(req) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
