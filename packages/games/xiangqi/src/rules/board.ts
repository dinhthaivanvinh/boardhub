import type { Color, PieceCode, XiangqiMove } from './types';

export const COLS = 9;
export const ROWS = 10;

type Board = readonly (PieceCode | null)[];

export const colorOfSeat = (seat: number): Color => (seat === 0 ? 'r' : 'b');
export const otherColor = (c: Color): Color => (c === 'r' ? 'b' : 'r');

const inBoard = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const inPalace = (color: Color, r: number, c: number) =>
  c >= 3 && c <= 5 && (color === 'b' ? r <= 2 : r >= 7);
const onOwnSide = (color: Color, r: number) => (color === 'b' ? r <= 4 : r >= 5);
const crossedRiver = (color: Color, r: number) => (color === 'r' ? r <= 4 : r >= 5);

const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export const INITIAL_BOARD: readonly (PieceCode | null)[] = (() => {
  const b: (PieceCode | null)[] = Array.from({ length: 90 }, () => null);
  const back = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'] as const;
  back.forEach((t, c) => {
    b[c] = `b${t}`;
    b[9 * COLS + c] = `r${t}`;
  });
  for (const c of [1, 7]) {
    b[2 * COLS + c] = 'bC';
    b[7 * COLS + c] = 'rC';
  }
  for (const c of [0, 2, 4, 6, 8]) {
    b[3 * COLS + c] = 'bP';
    b[6 * COLS + c] = 'rP';
  }
  return b;
})();

/** Points the piece on `from` could move to, ignoring checks (but respecting blocks and own pieces). */
export function pseudoTargets(board: Board, from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  const color = piece[0] as Color;
  const type = piece[1];
  const r = Math.floor(from / COLS);
  const c = from % COLS;
  const out: number[] = [];
  const at = (rr: number, cc: number) => board[rr * COLS + cc];
  const add = (rr: number, cc: number) => {
    if (!inBoard(rr, cc)) return;
    const target = at(rr, cc);
    if (!target || target[0] !== color) out.push(rr * COLS + cc);
  };

  switch (type) {
    case 'K':
      for (const [dr, dc] of ORTHO) if (inPalace(color, r + dr, c + dc)) add(r + dr, c + dc);
      break;
    case 'A':
      for (const [dr, dc] of DIAG) if (inPalace(color, r + dr, c + dc)) add(r + dr, c + dc);
      break;
    case 'E':
      for (const [dr, dc] of DIAG) {
        const rr = r + 2 * dr;
        const cc = c + 2 * dc;
        if (inBoard(rr, cc) && onOwnSide(color, rr) && !at(r + dr, c + dc)) add(rr, cc);
      }
      break;
    case 'H':
      for (const [dr, dc] of ORTHO) {
        if (!inBoard(r + dr, c + dc) || at(r + dr, c + dc)) continue; // the horse's leg is blocked
        if (dr !== 0) {
          add(r + 2 * dr, c - 1);
          add(r + 2 * dr, c + 1);
        } else {
          add(r - 1, c + 2 * dc);
          add(r + 1, c + 2 * dc);
        }
      }
      break;
    case 'R':
      for (const [dr, dc] of ORTHO) {
        for (let rr = r + dr, cc = c + dc; inBoard(rr, cc); rr += dr, cc += dc) {
          add(rr, cc);
          if (at(rr, cc)) break;
        }
      }
      break;
    case 'C':
      for (const [dr, dc] of ORTHO) {
        let screened = false;
        for (let rr = r + dr, cc = c + dc; inBoard(rr, cc); rr += dr, cc += dc) {
          const target = at(rr, cc);
          if (!screened) {
            if (target) screened = true;
            else out.push(rr * COLS + cc);
          } else if (target) {
            if (target[0] !== color) out.push(rr * COLS + cc);
            break;
          }
        }
      }
      break;
    case 'P': {
      const forward = color === 'r' ? -1 : 1;
      add(r + forward, c);
      if (crossedRiver(color, r)) {
        add(r, c - 1);
        add(r, c + 1);
      }
      break;
    }
  }
  return out;
}

export function kingSquare(board: Board, color: Color): number {
  return board.indexOf(`${color}K`);
}

/** The two generals on the same file with nothing between them. */
export function generalsFace(board: Board): boolean {
  const red = kingSquare(board, 'r');
  const black = kingSquare(board, 'b');
  if (red < 0 || black < 0 || red % COLS !== black % COLS) return false;
  for (let sq = black + COLS; sq < red; sq += COLS) if (board[sq]) return false;
  return true;
}

/** Is `color`'s general attacked (or facing the other general)? */
export function isInCheck(board: Board, color: Color): boolean {
  const king = kingSquare(board, color);
  if (king < 0) return true;
  if (generalsFace(board)) return true;
  const enemy = otherColor(color);
  for (let sq = 0; sq < board.length; sq++) {
    const p = board[sq];
    if (p && p[0] === enemy && pseudoTargets(board, sq).includes(king)) return true;
  }
  return false;
}

export function applyToBoard(board: Board, m: XiangqiMove): (PieceCode | null)[] {
  const next = board.slice();
  next[m.to] = next[m.from] ?? null;
  next[m.from] = null;
  return next;
}

/** Fully legal moves for `color`, in a stable order. */
export function legalMovesFor(board: Board, color: Color): XiangqiMove[] {
  const moves: XiangqiMove[] = [];
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p[0] !== color) continue;
    for (const to of pseudoTargets(board, from)) {
      if (!isInCheck(applyToBoard(board, { from, to }), color)) moves.push({ from, to });
    }
  }
  return moves;
}

/** 32-bit FNV-1a hash of the position (pieces + side to move). */
export function positionHash(board: Board, turn: number): number {
  let h = 2166136261;
  const mix = (code: number) => {
    h ^= code;
    h = Math.imul(h, 16777619);
  };
  for (const p of board) {
    if (p) {
      mix(p.charCodeAt(0));
      mix(p.charCodeAt(1));
    } else {
      mix(46);
    }
  }
  mix(48 + turn);
  return h >>> 0;
}
