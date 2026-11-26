import type { Translator } from '@bg/ui';
import { squareName } from '../rules/board';
import type { ChessMove, Piece } from '../rules/types';

/**
 * The two-level hint of a puzzle, as shown and as read aloud. There are too many piece-and-square sentences to
 * record whole, so it is read from the same parts as the coach's (see `speakParts`).
 */
export function hintParts(
  t: Translator,
  pos: { board: readonly (Piece | null)[] },
  move: ChessMove,
  level: number,
): { text: string; parts: string[] } {
  const from = squareName(move.from);
  const to = squareName(move.to);
  const piece = t(`games.chess.pieceNames.${pos.board[move.from]![1]}`);
  const intro = t('games.chess.coach.say.hintWord');
  return {
    text:
      level === 1
        ? t('games.chess.learn.checkmate.mate.hint1', { from })
        : t('games.chess.learn.checkmate.mate.hint2', { from, to }),
    parts:
      level === 1
        ? [intro, piece, t('games.chess.coach.say.at', { square: from })]
        : [
            intro,
            piece,
            t('games.chess.coach.say.from', { square: from }),
            t('games.chess.coach.say.to', { square: to }),
          ],
  };
}
