/**
 * Help for a child playing the computer: which of their pieces are about to be lost, and a move worth a look.
 * Both look one reply ahead only. They do not see forks or plans further away.
 */
import type { Seat } from '@bg/engine';
import type { Coach, Translator } from '@bg/ui';
import { evaluate } from './bot';
import { netGain } from './exchange';
import { PIECE_VALUE } from './learn/capture';
import { isCheckmate, isStalemate, matingMoves } from './learn/checkmate';
import { loadVoicePack, speakParts, stopSpeaking } from './learn/speech';
import { describe, legalMoves, makeMove, other, squareName } from './rules/board';
import { colorOfSeat, positionOf } from './rules/rules';
import type { ChessMove, ChessState, PieceType, Position } from './rules/types';

/** What the other side would win on each square if it were its turn now: the squares where that is something. */
function lossesAt(pos: Position, mine: 'w' | 'b'): Map<number, number> {
  const theirs: Position = { ...pos, turn: other(mine), enPassant: pos.turn === mine ? null : pos.enPassant };
  const losses = new Map<number, number>();
  for (const move of legalMoves(theirs)) {
    const victim = describe(theirs, move).captured;
    // A check is not a threatened piece: the board shows it already.
    if (!victim || victim[1] === 'K') continue;
    const gain = netGain(theirs, move);
    if (gain > (losses.get(move.to) ?? 0)) losses.set(move.to, gain);
  }
  return losses;
}

/** My pieces that the other side can win, the biggest loss first. Empty while in check: that comes first. */
export function threatenedSquares(pos: Position, mine: 'w' | 'b'): number[] {
  return [...lossesAt(pos, mine)].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([square]) => square);
}

export type HintReason = 'mate' | 'capture' | 'save' | 'good';
export type ChessHint = { move: ChessMove; reason: HintReason };

/** Points won by a move, less the most the answer can win back on any square. */
function swing(pos: Position, move: ChessMove, next: Position): number {
  const victim = describe(pos, move).captured;
  const won = victim ? PIECE_VALUE[victim[1] as PieceType] : 0;
  return won - Math.max(0, ...lossesAt(next, pos.turn).values());
}

/**
 * A move for the side to move: mate if there is one; otherwise one that does not allow a mate in one or a
 * stalemate, comes out best in material after the reply, and then stands best on the board.
 */
export function coachMove(state: ChessState): ChessHint | null {
  const pos = positionOf(state);
  const moves = legalMoves(pos);
  const mate = moves.find((m) => isCheckmate(makeMove(pos, m)));
  if (mate) return { move: mate, reason: 'mate' };

  const seat = (pos.turn === 'w' ? 0 : 1) as Seat;
  const threats = threatenedSquares(pos, pos.turn);
  let best: ChessMove | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = makeMove(pos, move);
    const material = swing(pos, move, next);
    const standing = evaluate({ ...state, board: next.board, inCheck: null }, seat);
    // Material counts for much more than where the pieces stand; the two bad outcomes count for more still.
    let score = material * 10_000 + standing;
    if (isStalemate(next)) score -= 10_000_000;
    else if (matingMoves(next).length > 0) score -= 100_000_000;
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  if (!best) return null;
  const next = makeMove(pos, best);
  const victim = describe(pos, best).captured;
  if (victim && swing(pos, best, next) > 0) return { move: best, reason: 'capture' };
  const saved = threats.length > 0 && lossesAt(next, pos.turn).size === 0;
  return { move: best, reason: saved ? 'save' : 'good' };
}

/** Only the biggest dangers are read: a long list would not be followed. All are shown. */
export const SPOKEN_THREATS = 2;

export const coach: Coach<ChessState> = {
  lastHint: (t) => t('games.chess.coach.lastHint'),
  voice: {
    prepare: (lang) => void loadVoicePack(lang),
    say: (parts, lang) => void speakParts(parts, lang),
    stop: stopSpeaking,
  },

  warn(view, seat) {
    if (view.status !== 'playing' || view.inCheck === seat) return null;
    const mine = colorOfSeat(seat);
    const cells = threatenedSquares(positionOf(view), mine);
    if (cells.length === 0) return null;
    return {
      cells,
      text: (t: Translator) =>
        t('games.chess.coach.threatened', {
          pieces: cells
            .map((s) =>
              t('games.chess.coach.pieceAt', {
                piece: t(`games.chess.pieceNames.${view.board[s]![1]}`),
                square: squareName(s),
              }),
            )
            .join(', '),
        }),
      speech: (t: Translator) => [
        t('games.chess.coach.say.warn'),
        ...cells
          .slice(0, SPOKEN_THREATS)
          .flatMap((s) => [
            t(`games.chess.pieceNames.${view.board[s]![1]}`),
            t('games.chess.coach.say.at', { square: squareName(s) }),
          ]),
      ],
    };
  },

  hint(view, seat) {
    if (view.status !== 'playing' || colorOfSeat(view.turn) !== colorOfSeat(seat)) return null;
    const found = coachMove(view);
    if (!found) return null;
    const { move, reason } = found;
    return {
      cells: [move.from, move.to],
      text: (t: Translator) =>
        t(`games.chess.coach.hint.${reason}`, {
          piece: t(`games.chess.pieceNames.${view.board[move.from]![1]}`),
          from: squareName(move.from),
          to: squareName(move.to),
        }),
      speech: (t: Translator) => [
        t(`games.chess.coach.say.${reason}`),
        t(`games.chess.pieceNames.${view.board[move.from]![1]}`),
        t('games.chess.coach.say.from', { square: squareName(move.from) }),
        t('games.chess.coach.say.to', { square: squareName(move.to) }),
      ],
    };
  },
};
