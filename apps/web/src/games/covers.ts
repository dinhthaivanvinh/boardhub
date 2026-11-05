// Cover art shown on the home page and game pages. Each game ships its own (packages/games/<id>/src/ui/cover.svg).
// Adding a game = one more line here.
import type { StaticImageData } from 'next/image';
import caro from '@bg/game-caro/cover.svg';
import fourInARow from '@bg/game-four-in-a-row/cover.svg';
import reversi from '@bg/game-reversi/cover.svg';
import xiangqi from '@bg/game-xiangqi/cover.svg';
import coGanh from '@bg/game-co-ganh/cover.svg';
import oAnQuan from '@bg/game-o-an-quan/cover.svg';
import banTau from '@bg/game-ban-tau/cover.svg';
import chess from '@bg/game-chess/cover.svg';
import type { GameId } from './catalog';

export const COVERS: Record<GameId, StaticImageData> = {
  caro,
  'four-in-a-row': fourInARow,
  reversi,
  xiangqi,
  'co-ganh': coGanh,
  'o-an-quan': oAnQuan,
  'ban-tau': banTau,
  chess,
};
