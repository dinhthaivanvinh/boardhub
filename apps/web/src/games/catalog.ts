// Server-safe game list: rules and translations only, no React.
// Adding a game = one entry here + one in client-registry.ts + one in bots.ts.
import { definition as caro } from '@bg/game-caro/rules';
import caroEn from '@bg/game-caro/i18n/en.json';
import caroVi from '@bg/game-caro/i18n/vi.json';
import type { AnyGameDefinition } from '@bg/engine';

export interface CatalogEntry {
  definition: AnyGameDefinition;
  messages: { vi: Record<string, unknown>; en: Record<string, unknown> };
}

export const GAMES = {
  caro: { definition: caro, messages: { vi: caroVi, en: caroEn } },
} satisfies Record<string, CatalogEntry>;

export type GameId = keyof typeof GAMES;
export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function isGameId(id: string): id is GameId {
  return Object.hasOwn(GAMES, id);
}

/** MVP games not built yet, shown as "coming soon" on the home page (docs/01 §4). */
export const UPCOMING_GAMES = ['four-in-a-row', 'reversi', 'xiangqi'] as const;
