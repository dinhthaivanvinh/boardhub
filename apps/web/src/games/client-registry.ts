// Client-side pieces of each game: board component, setup form fields, sounds.
import type { ComponentType } from 'react';
import * as banTau from '@bg/game-ban-tau';
import * as caro from '@bg/game-caro';
import * as chess from '@bg/game-chess';
import * as coGanh from '@bg/game-co-ganh';
import * as four from '@bg/game-four-in-a-row';
import * as oAnQuan from '@bg/game-o-an-quan';
import * as reversi from '@bg/game-reversi';
import * as xiangqi from '@bg/game-xiangqi';
import type { BoardProps, Coach, ConfigFieldSpec, MoveSounds, MusicMood, Translator } from '@bg/ui';
import type { GameId } from './catalog';

/** What a game's review is given: every position of the game, its moves, and the seat the player had. */
export interface GameReviewProps {
  states: readonly unknown[];
  moves: readonly { seat: number; move: unknown }[];
  seat: number;
  t: Translator;
  animate: boolean;
  lang?: string;
  onClose(): void;
}

export interface ClientGameEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Board: ComponentType<BoardProps<any, any>>;
  configFields: ConfigFieldSpec[];
  /** Small piece drawing for player cards. Falls back to the piece name. */
  PieceIcon?: ComponentType<{ seat: number; size?: number }>;
  /** What each move sounds like (docs/08 §10). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  moveSounds: MoveSounds<any>;
  /** Background music style. */
  music: MusicMood;
  /** Help against the computer, for games that offer it. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coach?: Coach<any>;
  /** Going over a finished game with the player, for games that offer it. */
  Review?: ComponentType<GameReviewProps>;
}

/** The same shape for every game package. */
const entry = (pkg: {
  Board: unknown;
  configFields: ConfigFieldSpec[];
  PieceIcon: ComponentType<{ seat: number; size?: number }>;
  moveSounds: unknown;
  music: MusicMood;
  coach?: unknown;
  Review?: unknown;
}): ClientGameEntry => ({
  Board: pkg.Board as ClientGameEntry['Board'],
  configFields: pkg.configFields,
  PieceIcon: pkg.PieceIcon,
  moveSounds: pkg.moveSounds as ClientGameEntry['moveSounds'],
  music: pkg.music,
  coach: pkg.coach as ClientGameEntry['coach'],
  ...(pkg.Review ? { Review: pkg.Review as ComponentType<GameReviewProps> } : {}),
});

export const CLIENT_GAMES: Record<GameId, ClientGameEntry> = {
  caro: entry(caro),
  'four-in-a-row': entry(four),
  reversi: entry(reversi),
  xiangqi: entry(xiangqi),
  'co-ganh': entry(coGanh),
  'o-an-quan': entry(oAnQuan),
  'ban-tau': entry(banTau),
  chess: entry(chess),
};
