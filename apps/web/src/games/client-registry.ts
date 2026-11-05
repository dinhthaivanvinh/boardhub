// Client-side pieces of each game: board component and setup form fields.
import type { ComponentType } from 'react';
import { Board as CaroBoard, configFields as caroFields, PieceIcon as CaroPiece } from '@bg/game-caro';
import {
  Board as FourBoard,
  configFields as fourFields,
  PieceIcon as FourPiece,
} from '@bg/game-four-in-a-row';
import {
  Board as ReversiBoard,
  configFields as reversiFields,
  PieceIcon as ReversiPiece,
} from '@bg/game-reversi';
import {
  Board as XiangqiBoard,
  configFields as xiangqiFields,
  PieceIcon as XiangqiPiece,
} from '@bg/game-xiangqi';
import {
  Board as CoGanhBoard,
  configFields as coGanhFields,
  PieceIcon as CoGanhPiece,
} from '@bg/game-co-ganh';
import {
  Board as OAnQuanBoard,
  configFields as oAnQuanFields,
  PieceIcon as OAnQuanPiece,
} from '@bg/game-o-an-quan';
import {
  Board as BanTauBoard,
  configFields as banTauFields,
  PieceIcon as BanTauPiece,
} from '@bg/game-ban-tau';
import { Board as ChessBoard, configFields as chessFields, PieceIcon as ChessPiece } from '@bg/game-chess';
import type { BoardProps, ConfigFieldSpec } from '@bg/ui';
import type { GameId } from './catalog';

export interface ClientGameEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Board: ComponentType<BoardProps<any, any>>;
  configFields: ConfigFieldSpec[];
  /** Small piece drawing for player cards. Falls back to the piece name. */
  PieceIcon?: ComponentType<{ seat: number; size?: number }>;
}

export const CLIENT_GAMES: Record<GameId, ClientGameEntry> = {
  caro: { Board: CaroBoard as ClientGameEntry['Board'], configFields: caroFields, PieceIcon: CaroPiece },
  'four-in-a-row': {
    Board: FourBoard as ClientGameEntry['Board'],
    configFields: fourFields,
    PieceIcon: FourPiece,
  },
  reversi: {
    Board: ReversiBoard as ClientGameEntry['Board'],
    configFields: reversiFields,
    PieceIcon: ReversiPiece,
  },
  xiangqi: {
    Board: XiangqiBoard as ClientGameEntry['Board'],
    configFields: xiangqiFields,
    PieceIcon: XiangqiPiece,
  },
  'co-ganh': {
    Board: CoGanhBoard as ClientGameEntry['Board'],
    configFields: coGanhFields,
    PieceIcon: CoGanhPiece,
  },
  'o-an-quan': {
    Board: OAnQuanBoard as ClientGameEntry['Board'],
    configFields: oAnQuanFields,
    PieceIcon: OAnQuanPiece,
  },
  'ban-tau': {
    Board: BanTauBoard as ClientGameEntry['Board'],
    configFields: banTauFields,
    PieceIcon: BanTauPiece,
  },
  chess: {
    Board: ChessBoard as ClientGameEntry['Board'],
    configFields: chessFields,
    PieceIcon: ChessPiece,
  },
};
