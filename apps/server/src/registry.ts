// Games the server can host. Import rules and bots only (never UI).
// Adding a game = one line in each map (docs/04, skill bg-add-game).
import type { Bot } from '@bg/bots';
import type { AnyGameDefinition } from '@bg/engine';
import { bot as caroBot } from '@bg/game-caro/bot';
import { definition as caro } from '@bg/game-caro/rules';
import { bot as coGanhBot } from '@bg/game-co-ganh/bot';
import { definition as coGanh } from '@bg/game-co-ganh/rules';
import { bot as banTauBot } from '@bg/game-ban-tau/bot';
import { definition as banTau } from '@bg/game-ban-tau/rules';
import { bot as chessBot } from '@bg/game-chess/bot';
import { definition as chess } from '@bg/game-chess/rules';
import { bot as oAnQuanBot } from '@bg/game-o-an-quan/bot';
import { definition as oAnQuan } from '@bg/game-o-an-quan/rules';
import { bot as fourBot } from '@bg/game-four-in-a-row/bot';
import { definition as fourInARow } from '@bg/game-four-in-a-row/rules';
import { bot as xiangqiBot } from '@bg/game-xiangqi/bot';
import { definition as xiangqi } from '@bg/game-xiangqi/rules';
import { bot as reversiBot } from '@bg/game-reversi/bot';
import { definition as reversi } from '@bg/game-reversi/rules';

export const GAME_DEFS: Record<string, AnyGameDefinition> = {
  caro,
  'four-in-a-row': fourInARow,
  reversi: reversi,
  xiangqi: xiangqi,
  'co-ganh': coGanh,
  'o-an-quan': oAnQuan,
  'ban-tau': banTau,
  chess,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_BOTS: Record<string, Bot<any, any>> = {
  caro: caroBot,
  'four-in-a-row': fourBot,
  reversi: reversiBot,
  xiangqi: xiangqiBot,
  'co-ganh': coGanhBot,
  'o-an-quan': oAnQuanBot,
  'ban-tau': banTauBot,
  chess: chessBot,
};
