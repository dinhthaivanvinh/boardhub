import type { BotLevel } from '@bg/bots';
import { createRng, type Seat } from '@bg/engine';
import { BOTS } from '@/games/bots';
import type { GameId } from '@/games/catalog';

export interface BotRequest {
  gameId: GameId;
  state: unknown;
  seat: Seat;
  level: BotLevel;
  seed: string;
  moveIndex: number;
}

/** Hard cap on thinking time; each level also has its own, smaller budget. */
export const BOT_MAX_THINK_MS = 3000;

export function computeBotMove(req: BotRequest, now: () => number = Date.now): unknown {
  const bot = BOTS[req.gameId];
  if (!bot) throw new Error(`no bot for game ${req.gameId}`);
  return bot.chooseMove({
    state: req.state,
    seat: req.seat,
    level: req.level,
    // Own RNG stream, separate from the match RNG, so bot choices are reproducible too (rule B1).
    rng: createRng(`bot:${req.seed}`, req.moveIndex),
    deadlineMs: now() + BOT_MAX_THINK_MS,
    now,
  });
}
