// Server-safe game list: rules and translations only, no React.
// Adding a game = one entry here + one in client-registry.ts + one in bots.ts.
import { definition as caro } from '@bg/game-caro/rules';
import caroEn from '@bg/game-caro/i18n/en.json';
import caroVi from '@bg/game-caro/i18n/vi.json';
import { definition as fourInARow } from '@bg/game-four-in-a-row/rules';
import fourEn from '@bg/game-four-in-a-row/i18n/en.json';
import fourVi from '@bg/game-four-in-a-row/i18n/vi.json';
import { definition as reversi } from '@bg/game-reversi/rules';
import reversiEn from '@bg/game-reversi/i18n/en.json';
import reversiVi from '@bg/game-reversi/i18n/vi.json';
import { definition as xiangqi } from '@bg/game-xiangqi/rules';
import xiangqiEn from '@bg/game-xiangqi/i18n/en.json';
import xiangqiVi from '@bg/game-xiangqi/i18n/vi.json';
import type { AnyGameDefinition } from '@bg/engine';

export interface CatalogEntry {
  definition: AnyGameDefinition;
  messages: { vi: Record<string, unknown>; en: Record<string, unknown> };
}

const ENTRIES = {
  caro: { definition: caro, messages: { vi: caroVi, en: caroEn } },
  'four-in-a-row': { definition: fourInARow, messages: { vi: fourVi, en: fourEn } },
  reversi: { definition: reversi, messages: { vi: reversiVi, en: reversiEn } },
  xiangqi: { definition: xiangqi, messages: { vi: xiangqiVi, en: xiangqiEn } },
} satisfies Record<string, CatalogEntry>;

export type GameId = keyof typeof ENTRIES;
/** Typed by the shared contract, so screens work the same for every game. */
export const GAMES: Record<GameId, CatalogEntry> = ENTRIES;
export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function isGameId(id: string): id is GameId {
  return Object.hasOwn(GAMES, id);
}

/** MVP games not built yet, shown as "coming soon" on the home page (docs/01 §4). */
export const UPCOMING_GAMES: readonly string[] = [];
