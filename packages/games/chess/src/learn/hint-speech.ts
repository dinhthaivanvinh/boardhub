import type { Translator } from '@bg/ui';
import { squareName } from '../rules/board';
import type { ChessMove } from '../rules/types';

/**
 * The two-level hint of a puzzle, as shown and as read aloud: the same words. The first is recorded whole. There
 * are too many pairs of squares to record the second whole, so it is read in two halves (see `speakParts`) which,
 * put together, are the sentence on the screen.
 */
export function hintParts(t: Translator, move: ChessMove, level: number): { text: string; parts: string[] } {
  const from = squareName(move.from);
  const to = squareName(move.to);
  if (level === 1) {
    const text = t('games.chess.learn.checkmate.mate.hint1', { from });
    return { text, parts: [text] };
  }
  return {
    text: t('games.chess.learn.checkmate.mate.hint2', { from, to }),
    parts: [t('games.chess.learn.hintSteps.from', { from }), t('games.chess.learn.hintSteps.to', { to })],
  };
}
