'use client';

import { useState } from 'react';
import { CELL, GridBoard, SlidingPiece, VisuallyHidden, type BoardProps } from '@bg/ui';
import { colorOfSeat, COLS, kingSquare, legalMovesFor, ROWS } from '../rules/board';
import type { PieceCode, PieceType, XiangqiMove, XiangqiState } from '../rules/types';

export type XiangqiBoardProps = BoardProps<XiangqiState, XiangqiMove>;

/** Traditional glyphs: Red and Black use different characters for most pieces. */
const GLYPHS: Record<'r' | 'b', Record<PieceType, string>> = {
  r: { K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', P: '兵' },
  b: { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', P: '卒' },
};

const HALF = CELL / 2;

function Piece({ code, cx, cy, className }: { code: PieceCode; cx: number; cy: number; className?: string }) {
  const color = code[0] as 'r' | 'b';
  return (
    <g className={[`xq-piece xq-${color}`, className].filter(Boolean).join(' ')}>
      <circle cx={cx} cy={cy} r={CELL * 0.43} className="xq-disc" />
      <circle cx={cx} cy={cy} r={CELL * 0.36} className="xq-ring" />
      <text x={cx} y={cy} className="xq-glyph" textAnchor="middle" dominantBaseline="central">
        {GLYPHS[color][code[1] as PieceType]}
      </text>
    </g>
  );
}

/** General of each side, used in player cards. */
export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox={`0 0 ${CELL} ${CELL}`} width={size} height={size} aria-hidden="true">
      <Piece code={seat === 0 ? 'rK' : 'bK'} cx={HALF} cy={HALF} />
    </svg>
  );
}

/** Lines between intersections, the river and the palaces. Drawn in board coordinates (Red at the bottom). */
function Lines() {
  const x = (c: number) => c * CELL + HALF;
  const y = (r: number) => r * CELL + HALF;
  return (
    <g className="xq-lines">
      {Array.from({ length: ROWS }, (_, r) => (
        <line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(8)} y2={y(r)} />
      ))}
      {Array.from({ length: COLS }, (_, c) =>
        c === 0 || c === 8 ? (
          <line key={`v${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(9)} />
        ) : (
          <g key={`v${c}`}>
            <line x1={x(c)} y1={y(0)} x2={x(c)} y2={y(4)} />
            <line x1={x(c)} y1={y(5)} x2={x(c)} y2={y(9)} />
          </g>
        ),
      )}
      {[0, 7].map((top) => (
        <g key={top}>
          <line x1={x(3)} y1={y(top)} x2={x(5)} y2={y(top + 2)} />
          <line x1={x(5)} y1={y(top)} x2={x(3)} y2={y(top + 2)} />
        </g>
      ))}
      <text
        x={x(2)}
        y={(y(4) + y(5)) / 2}
        className="xq-river"
        textAnchor="middle"
        dominantBaseline="central"
      >
        楚 河
      </text>
      <text
        x={x(6)}
        y={(y(4) + y(5)) / 2}
        className="xq-river"
        textAnchor="middle"
        dominantBaseline="central"
      >
        漢 界
      </text>
    </g>
  );
}

export function Board({
  view,
  mySeat,
  isMyTurn,
  disabled,
  onMove,
  orientation,
  settings,
  t,
}: XiangqiBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setSelected(null);
  }

  // Black sits at the bottom when playing Black: the display is rotated 180°.
  const flipped = (orientation ?? mySeat ?? 0) === 1;
  const toBoard = (display: number) => (flipped ? 89 - display : display);

  const canPlay = isMyTurn && !disabled && view.status === 'playing' && mySeat !== null;
  const myColor = colorOfSeat(mySeat ?? 0);
  const moves = canPlay ? legalMovesFor(view.board, myColor) : [];
  const targets = new Set(selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to));
  const movable = new Set(moves.map((m) => m.from));
  const checkedKing = view.inCheck === null ? -1 : kingSquare(view.board, colorOfSeat(view.inCheck));

  const pieceLabel = (code: PieceCode) =>
    t('games.xiangqi.pieceLabel', {
      type: t(`games.xiangqi.pieceNames.${code[1]}`),
      color: t(`games.xiangqi.pieces.${code[0] === 'r' ? 0 : 1}`),
    });
  // Coordinates as the player sees them: columns left to right, rows from the bottom.
  const coords = (display: number) => ({ col: (display % COLS) + 1, row: ROWS - Math.floor(display / COLS) });
  const displayOf = (sq: number) => (flipped ? 89 - sq : sq);

  const activate = (display: number) => {
    const sq = toBoard(display);
    if (!canPlay) return;
    if (selected !== null && targets.has(sq)) {
      setSelected(null);
      onMove({ from: selected, to: sq });
      return;
    }
    const piece = view.board[sq];
    setSelected(piece && piece[0] === myColor && movable.has(sq) && sq !== selected ? sq : null);
  };

  const last = view.lastMove;
  const lastPiece = last ? view.board[last.to] : null;
  /** Centre of a board point on screen. */
  const centre = (sq: number) => {
    const d = displayOf(sq);
    return { x: (d % COLS) * CELL + HALF, y: Math.floor(d / COLS) * CELL + HALF };
  };
  const pieceClass = (sq: number) =>
    [sq === selected && 'xq-selected', sq === checkedKing && 'xq-check'].filter(Boolean).join(' ');

  return (
    <div className="xq-board">
      <GridBoard
        rows={ROWS}
        cols={COLS}
        gridLines={false}
        // The lines look the same after a half turn, so they are never rotated: that keeps the river text upright.
        background={<Lines />}
        label={t('games.xiangqi.boardLabel')}
        cellLabel={(display) => {
          const piece = view.board[toBoard(display)];
          return t('games.xiangqi.cellLabel', {
            ...coords(display),
            piece: piece ? pieceLabel(piece) : t('games.xiangqi.empty'),
          });
        }}
        onActivate={activate}
        overlay={
          last && lastPiece ? (
            <SlidingPiece
              key={view.moveCount}
              from={centre(last.from)}
              to={centre(last.to)}
              animate={settings.animations}
            >
              <Piece
                code={lastPiece}
                cx={centre(last.to).x}
                cy={centre(last.to).y}
                className={pieceClass(last.to)}
              />
            </SlidingPiece>
          ) : undefined
        }
        cellData={(display) => {
          const sq = toBoard(display);
          const piece = view.board[sq];
          return {
            'data-piece': piece ?? undefined,
            'data-selected': sq === selected ? 'true' : undefined,
            'data-target': targets.has(sq) ? 'true' : undefined,
            'data-last': last && (sq === last.from || sq === last.to) ? 'true' : undefined,
            'data-check': sq === checkedKing ? 'true' : undefined,
          };
        }}
        renderCell={(display, geom) => {
          const sq = toBoard(display);
          const piece = view.board[sq];
          const cx = geom.x + HALF;
          const cy = geom.y + HALF;
          const isLast = last && (sq === last.from || sq === last.to);
          return (
            <>
              {isLast && <rect className="xq-last" x={cx - 18} y={cy - 18} width={36} height={36} rx={4} />}
              {piece && !(last && sq === last.to) && (
                <Piece code={piece} cx={cx} cy={cy} className={pieceClass(sq)} />
              )}
              {targets.has(sq) &&
                (piece ? (
                  <circle className="xq-capture" cx={cx} cy={cy} r={CELL * 0.46} />
                ) : (
                  <circle className="xq-target" cx={cx} cy={cy} r={CELL * 0.12} />
                ))}
            </>
          );
        }}
      />
      <VisuallyHidden live>
        {last && lastPiece
          ? `${t('games.xiangqi.lastMove', {
              piece: pieceLabel(lastPiece),
              from: `${coords(displayOf(last.from)).col}-${coords(displayOf(last.from)).row}`,
              to: `${coords(displayOf(last.to)).col}-${coords(displayOf(last.to)).row}`,
            })}${view.inCheck !== null ? ` ${t('games.xiangqi.check')}` : ''}`
          : ''}
      </VisuallyHidden>
    </div>
  );
}
