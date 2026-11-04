// Bots per game. Imported by the bot Web Worker, so keep React out of here.
import type { Bot } from '@bg/bots';
import { bot as caroBot } from '@bg/game-caro/bot';
import { bot as fourBot } from '@bg/game-four-in-a-row/bot';
import type { GameId } from './catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOTS: Record<GameId, Bot<any, any>> = {
  caro: caroBot,
  'four-in-a-row': fourBot,
};
