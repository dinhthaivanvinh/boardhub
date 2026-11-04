import { parentPort } from 'node:worker_threads';
import { computeBotMove, type BotRequest } from './bot-runner';

parentPort?.on('message', (req: BotRequest) => {
  try {
    parentPort?.postMessage({ ok: true, move: computeBotMove(req) });
  } catch (err) {
    parentPort?.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
