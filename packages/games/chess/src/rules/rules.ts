import { z } from 'zod';
import type { GameResult, MoveCheck, Seat } from '@bg/engine';
import {
  colorOf,
  describe,
  fromFen,
  inCheck,
  insufficientMaterial,
  legalMoves as legalPositionMoves,
  makeMove,
  positionHash,
  pseudoMoves,
  rowOf,
  START_FEN,
} from './board';
import type { ChessConfig, ChessMove, ChessSeat, ChessState, Color, Position } from './types';

export const configSchema = z.strictObject({}) as z.ZodType<ChessConfig>;
export const moveSchema = z.strictObject({
  from: z.number().int(),
  to: z.number().int(),
  promotion: z.enum(['Q', 'R', 'B', 'N']).optional(),
});

export const colorOfSeat = (seat: Seat): Color => (seat === 0 ? 'w' : 'b');
const seatOfColor = (c: Color): ChessSeat => (c === 'w' ? 0 : 1);

export function positionOf(s: ChessState): Position {
  return { board: s.board, turn: colorOfSeat(s.turn), castling: s.castling, enPassant: s.enPassant };
}

/** A game state from a position (used by setup and by tests that start from a FEN). */
export function stateFromPosition(pos: Position, config: ChessConfig = {}): ChessState {
  const turn = seatOfColor(pos.turn);
  return withStatus({
    config,
    board: pos.board,
    turn,
    castling: pos.castling,
    enPassant: pos.enPassant,
    halfmove: 0,
    fullmove: 1,
    moveCount: 0,
    lastMove: null,
    positions: [positionHash(pos)],
    inCheck: null,
    status: 'playing',
    winner: null,
  });
}

export function setup(config: ChessConfig): ChessState {
  return stateFromPosition(fromFen(START_FEN), config);
}

/** Check, mate, stalemate and the automatic draws, for the side to move. */
function withStatus(s: ChessState): ChessState {
  const pos = positionOf(s);
  const checked = inCheck(pos.board, pos.turn);
  const canMove = legalPositionMoves(pos).length > 0;
  const current = s.positions[s.positions.length - 1];
  let status: ChessState['status'] = 'playing';
  if (!canMove) status = checked ? 'checkmate' : 'stalemate';
  else if (insufficientMaterial(pos.board)) status = 'insufficient';
  else if (s.positions.filter((h) => h === current).length >= 3) status = 'repetition';
  else if (s.halfmove >= 100) status = 'fifty_moves';
  return {
    ...s,
    inCheck: checked ? s.turn : null,
    status,
    winner: status === 'checkmate' ? (s.turn === 0 ? 1 : 0) : null,
  };
}

export function validateMove(s: ChessState, seat: Seat, m: ChessMove): MoveCheck {
  const inside = (x: number) => x >= 0 && x < 64;
  if (!inside(m.from) || !inside(m.to)) return { ok: false, code: 'chess.out_of_bounds' };
  const piece = s.board[m.from];
  if (!piece) return { ok: false, code: 'chess.no_piece' };
  if (colorOf(piece) !== colorOfSeat(seat)) return { ok: false, code: 'chess.not_your_piece' };
  const pos = positionOf(s);
  const lastRow = piece === 'wP' ? 0 : piece === 'bP' ? 7 : -1;
  if (rowOf(m.to) === lastRow && !m.promotion) return { ok: false, code: 'chess.needs_promotion' };
  if (rowOf(m.to) !== lastRow && m.promotion) return { ok: false, code: 'chess.needs_promotion' };
  const pseudo = pseudoMoves(pos).find(
    (x) => x.from === m.from && x.to === m.to && (x.promotion ?? null) === (m.promotion ?? null),
  );
  if (!pseudo) return { ok: false, code: 'chess.illegal_move' };
  if (inCheck(makeMove(pos, pseudo).board, pos.turn)) return { ok: false, code: 'chess.self_check' };
  return { ok: true };
}

export function applyMove(s: ChessState, _seat: Seat, m: ChessMove): ChessState {
  const pos = positionOf(s);
  const { piece, captured, castle, enPassant } = describe(pos, m);
  const next = makeMove(pos, m);
  // Pawn moves, captures and lost castling rights can never be undone: earlier positions cannot repeat.
  const irreversible = piece[1] === 'P' || captured !== null || next.castling !== pos.castling;
  const hash = positionHash(next);
  return withStatus({
    ...s,
    board: next.board,
    turn: seatOfColor(next.turn),
    castling: next.castling,
    enPassant: next.enPassant,
    halfmove: piece[1] === 'P' || captured ? 0 : s.halfmove + 1,
    fullmove: s.fullmove + (s.turn === 1 ? 1 : 0),
    moveCount: s.moveCount + 1,
    lastMove: {
      from: m.from,
      to: m.to,
      promotion: m.promotion ?? null,
      piece,
      captured,
      castle,
      enPassant,
    },
    positions: irreversible ? [hash] : [...s.positions, hash],
  });
}

export function legalMoves(s: ChessState, seat: Seat): ChessMove[] {
  if (s.status !== 'playing' || colorOfSeat(seat) !== colorOfSeat(s.turn)) return [];
  return legalPositionMoves(positionOf(s));
}

export function result(s: ChessState): GameResult | null {
  if (s.status === 'playing') return null;
  if (s.status === 'checkmate') return { kind: 'win', winners: [s.winner ?? 0], reason: 'checkmate' };
  return { kind: 'draw', reason: s.status };
}
