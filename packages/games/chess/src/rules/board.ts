import type { ChessMove, Color, Piece, PieceType, Position, Promotion } from './types';

type Board = readonly (Piece | null)[];

export const FILES = 'abcdefgh';
export const rowOf = (sq: number) => sq >> 3;
export const colOf = (sq: number) => sq & 7;
export const sq = (row: number, col: number) => row * 8 + col;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
/** "e4" for a square index. */
export const squareName = (s: number) => `${FILES[colOf(s)]}${8 - rowOf(s)}`;
/** Square index for "e4". */
export const squareOf = (name: string) => sq(8 - Number(name[1]), FILES.indexOf(name[0]!));

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorOf = (p: Piece) => p[0] as Color;
export const typeOf = (p: Piece) => p[1] as PieceType;

const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const;
const KING = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;
const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;
const PROMOTIONS: Promotion[] = ['Q', 'R', 'B', 'N'];

/** True if `target` is attacked by any piece of colour `by`. */
export function isAttacked(board: Board, target: number, by: Color): boolean {
  const r = rowOf(target);
  const c = colOf(target);
  // Pawns: a white pawn attacks upwards (towards row 0), so it sits one row below the target.
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inside(pr, c + dc) && board[sq(pr, c + dc)] === `${by}P`) return true;
  }
  for (const [dr, dc] of KNIGHT) {
    if (inside(r + dr, c + dc) && board[sq(r + dr, c + dc)] === `${by}N`) return true;
  }
  for (const [dr, dc] of KING) {
    if (inside(r + dr, c + dc) && board[sq(r + dr, c + dc)] === `${by}K`) return true;
  }
  const ray = (dirs: readonly (readonly [number, number])[], types: string) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[sq(rr, cc)];
        if (p) {
          if (p[0] === by && types.includes(p[1]!)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  };
  return ray(ROOK_DIRS, 'RQ') || ray(BISHOP_DIRS, 'BQ');
}

export function kingSquare(board: Board, color: Color): number {
  return board.indexOf(`${color}K`);
}

export function inCheck(board: Board, color: Color): boolean {
  const k = kingSquare(board, color);
  return k >= 0 && isAttacked(board, k, other(color));
}

/** Moves that follow how pieces move, before checking that the king is safe. */
export function pseudoMoves(pos: Position): ChessMove[] {
  const { board, turn } = pos;
  const enemy = other(turn);
  const moves: ChessMove[] = [];
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p[0] !== turn) continue;
    const r = rowOf(from);
    const c = colOf(from);
    const add = (to: number) => moves.push({ from, to });
    switch (p[1] as PieceType) {
      case 'P': {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        const lastRow = turn === 'w' ? 0 : 7;
        const push = (to: number) => {
          if (rowOf(to) === lastRow) for (const promotion of PROMOTIONS) moves.push({ from, to, promotion });
          else add(to);
        };
        const one = sq(r + dir, c);
        if (!board[one]) {
          push(one);
          const two = sq(r + 2 * dir, c);
          if (r === startRow && !board[two]) add(two);
        }
        for (const dc of [-1, 1]) {
          if (!inside(r + dir, c + dc)) continue;
          const to = sq(r + dir, c + dc);
          const target = board[to];
          if ((target && target[0] === enemy) || to === pos.enPassant) push(to);
        }
        break;
      }
      case 'N':
      case 'K': {
        for (const [dr, dc] of p[1] === 'N' ? KNIGHT : KING) {
          if (!inside(r + dr, c + dc)) continue;
          const to = sq(r + dr, c + dc);
          if (board[to]?.[0] !== turn) add(to);
        }
        if (p[1] === 'K') castlingMoves(pos, from, moves);
        break;
      }
      default: {
        const dirs = p[1] === 'R' ? ROOK_DIRS : p[1] === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
        for (const [dr, dc] of dirs) {
          let rr = r + dr;
          let cc = c + dc;
          while (inside(rr, cc)) {
            const to = sq(rr, cc);
            const target = board[to];
            if (target?.[0] === turn) break;
            add(to);
            if (target) break;
            rr += dr;
            cc += dc;
          }
        }
      }
    }
  }
  return moves;
}

function castlingMoves(pos: Position, from: number, moves: ChessMove[]) {
  const { board, turn, castling } = pos;
  const home = turn === 'w' ? 60 : 4;
  if (from !== home) return;
  const enemy = other(turn);
  if (isAttacked(board, home, enemy)) return;
  const [kSide, qSide] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
  // King side: f and g empty and safe, rook on h.
  if (castling.includes(kSide!) && board[home + 3] === `${turn}R`) {
    if (
      !board[home + 1] &&
      !board[home + 2] &&
      !isAttacked(board, home + 1, enemy) &&
      !isAttacked(board, home + 2, enemy)
    ) {
      moves.push({ from, to: home + 2 });
    }
  }
  // Queen side: b, c, d empty; c and d safe; rook on a.
  if (castling.includes(qSide!) && board[home - 4] === `${turn}R`) {
    if (
      !board[home - 1] &&
      !board[home - 2] &&
      !board[home - 3] &&
      !isAttacked(board, home - 1, enemy) &&
      !isAttacked(board, home - 2, enemy)
    ) {
      moves.push({ from, to: home - 2 });
    }
  }
}

/** Details of a move on a position: what it captures, whether it castles or takes en passant. */
export function describe(pos: Position, m: ChessMove) {
  const piece = pos.board[m.from]!;
  const isPawn = piece[1] === 'P';
  const enPassant = isPawn && m.to === pos.enPassant && colOf(m.from) !== colOf(m.to) && !pos.board[m.to];
  const castle =
    piece[1] === 'K' && Math.abs(colOf(m.to) - colOf(m.from)) === 2 ? (m.to > m.from ? 'K' : 'Q') : null;
  const capturedSquare = enPassant ? sq(rowOf(m.from), colOf(m.to)) : m.to;
  const captured = pos.board[capturedSquare] ?? null;
  return { piece, enPassant, castle, captured, capturedSquare } as const;
}

/** The position after a move (no legality check). */
export function makeMove(pos: Position, m: ChessMove): Position {
  const { piece, castle, capturedSquare } = describe(pos, m);
  const board = pos.board.slice();
  board[capturedSquare] = null;
  board[m.from] = null;
  board[m.to] = m.promotion ? (`${piece[0]}${m.promotion}` as Piece) : piece;
  if (castle) {
    const row = rowOf(m.from);
    const [rookFrom, rookTo] = castle === 'K' ? [sq(row, 7), sq(row, 5)] : [sq(row, 0), sq(row, 3)];
    board[rookTo] = board[rookFrom]!;
    board[rookFrom] = null;
  }
  // Rights are lost when the king or a rook leaves home, or a rook is captured at home.
  let castling = pos.castling;
  const drop = (s: number) => {
    if (s === 60) castling = castling.replace('K', '').replace('Q', '');
    if (s === 4) castling = castling.replace('k', '').replace('q', '');
    if (s === 63) castling = castling.replace('K', '');
    if (s === 56) castling = castling.replace('Q', '');
    if (s === 7) castling = castling.replace('k', '');
    if (s === 0) castling = castling.replace('q', '');
  };
  drop(m.from);
  drop(m.to);
  const double = piece[1] === 'P' && Math.abs(rowOf(m.to) - rowOf(m.from)) === 2;
  return {
    board,
    turn: other(pos.turn),
    castling,
    enPassant: double ? (m.from + m.to) / 2 : null,
  };
}

/** Moves that do not leave the mover's king in check. */
export function legalMoves(pos: Position): ChessMove[] {
  return pseudoMoves(pos).filter((m) => !inCheck(makeMove(pos, m).board, pos.turn));
}

/** Number of move sequences of `depth` plies: the standard check of a move generator. */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(pos, m), depth - 1);
  return n;
}

/** Neither side can possibly mate: K v K, K+minor v K, K+B v K+B with bishops on the same colour. */
export function insufficientMaterial(board: Board): boolean {
  const others: { piece: Piece; square: number }[] = [];
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (p && p[1] !== 'K') others.push({ piece: p, square: s });
  }
  if (others.length === 0) return true;
  if (others.length === 1) return others[0]!.piece[1] === 'B' || others[0]!.piece[1] === 'N';
  if (
    others.length === 2 &&
    others.every((o) => o.piece[1] === 'B') &&
    others[0]!.piece[0] !== others[1]!.piece[0]
  ) {
    const shade = (s: number) => (rowOf(s) + colOf(s)) % 2;
    return shade(others[0]!.square) === shade(others[1]!.square);
  }
  return false;
}

/** Hash of what makes positions "the same" for repetition: pieces, side to move, castling, en passant. */
export function positionHash(pos: Position): number {
  let h = 2166136261;
  const mix = (code: number) => {
    h ^= code;
    h = Math.imul(h, 16777619);
  };
  for (const p of pos.board) {
    if (p) {
      mix(p.charCodeAt(0));
      mix(p.charCodeAt(1));
    } else mix(46);
  }
  mix(pos.turn.charCodeAt(0));
  for (const ch of pos.castling) mix(ch.charCodeAt(0));
  mix(pos.enPassant === null ? 99 : pos.enPassant);
  return h >>> 0;
}

/** Position from the first four fields of a FEN string. */
export function fromFen(fen: string): Position {
  const [placement, turn, castling, ep] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = [];
  for (const ch of placement!.replace(/\//g, '')) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push(null);
    else board.push(`${ch === ch.toUpperCase() ? 'w' : 'b'}${ch.toUpperCase()}` as Piece);
  }
  if (board.length !== 64) throw new Error(`bad FEN: ${fen}`);
  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: castling && castling !== '-' ? castling : '',
    enPassant: ep && ep !== '-' ? squareOf(ep) : null,
  };
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
