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
import type { BoardProps, ConfigFieldSpec, MoveSounds, MusicMood } from '@bg/ui';
import type { GameId } from './catalog';

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
}

/** The same shape for every game package. */
const entry = (pkg: {
  Board: unknown;
  configFields: ConfigFieldSpec[];
  PieceIcon: ComponentType<{ seat: number; size?: number }>;
  moveSounds: unknown;
  music: MusicMood;
}): ClientGameEntry => ({
  Board: pkg.Board as ClientGameEntry['Board'],
  configFields: pkg.configFields,
  PieceIcon: pkg.PieceIcon,
  moveSounds: pkg.moveSounds as ClientGameEntry['moveSounds'],
  music: pkg.music,
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
