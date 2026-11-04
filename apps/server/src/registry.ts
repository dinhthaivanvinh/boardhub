// Games the server can host. Import rules and bots only (never UI).
// Adding a game = one line in each map (docs/04, skill bg-add-game).
import type { Bot } from '@bg/bots';
import type { AnyGameDefinition } from '@bg/engine';
import { bot as caroBot } from '@bg/game-caro/bot';
import { definition as caro } from '@bg/game-caro/rules';
import { bot as fourBot } from '@bg/game-four-in-a-row/bot';
import { definition as fourInARow } from '@bg/game-four-in-a-row/rules';

export const GAME_DEFS: Record<string, AnyGameDefinition> = {
  caro,
  'four-in-a-row': fourInARow,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_BOTS: Record<string, Bot<any, any>> = {
  caro: caroBot,
  'four-in-a-row': fourBot,
};
