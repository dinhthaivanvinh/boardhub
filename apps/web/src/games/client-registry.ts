// Client-side pieces of each game: board component and setup form fields.
import type { ComponentType } from 'react';
import { Board as CaroBoard, configFields as caroFields } from '@bg/game-caro';
import type { BoardProps, ConfigFieldSpec } from '@bg/ui';
import type { GameId } from './catalog';

export interface ClientGameEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Board: ComponentType<BoardProps<any, any>>;
  configFields: ConfigFieldSpec[];
}

export const CLIENT_GAMES: Record<GameId, ClientGameEntry> = {
  caro: { Board: CaroBoard as ClientGameEntry['Board'], configFields: caroFields },
};
