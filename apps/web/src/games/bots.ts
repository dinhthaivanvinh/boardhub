// Bots per game. Imported by the bot Web Worker, so keep React out of here.
import type { Bot } from '@bg/bots';
import { bot as caroBot } from '@bg/game-caro/bot';
import { bot as fourBot } from '@bg/game-four-in-a-row/bot';
import { bot as reversiBot } from '@bg/game-reversi/bot';
import { bot as xiangqiBot } from '@bg/game-xiangqi/bot';
import { bot as coGanhBot } from '@bg/game-co-ganh/bot';
import { bot as oAnQuanBot } from '@bg/game-o-an-quan/bot';
import { bot as banTauBot } from '@bg/game-ban-tau/bot';
import type { GameId } from './catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BOTS: Record<GameId, Bot<any, any>> = {
  caro: caroBot,
  'four-in-a-row': fourBot,
  reversi: reversiBot,
  xiangqi: xiangqiBot,
  'co-ganh': coGanhBot,
  'o-an-quan': oAnQuanBot,
  'ban-tau': banTauBot,
};
