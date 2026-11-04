'use client';

import { useState, type CSSProperties } from 'react';
import { CELL, GridBoard, VisuallyHidden, type BoardProps, type CellGeometry } from '@bg/ui';
import { dropRow } from '../rules/board';
import type { FourMove, FourSeat, FourState } from '../rules/types';

export type FourBoardProps = BoardProps<FourState, FourMove>;

/** Yellow is a solid disc, Red has an inner ring, so they differ by shape as well as colour. */
function Disc({
  piece,
  cx,
  cy,
  r,
  className,
  style,
}: {
  piece: FourSeat;
  cx: number;
  cy: number;
  r: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={[`fiar-p${piece}`, className].filter(Boolean).join(' ')} style={style}>
      <circle cx={cx} cy={cy} r={r} className="fiar-disc" />
      {piece === 1 && <circle cx={cx} cy={cy} r={r * 0.55} className="fiar-mark" />}
    </g>
  );
}

/** Small piece used outside the board (player cards). */
export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <Disc piece={seat === 0 ? 0 : 1} cx={12} cy={12} r={10} />
    </svg>
  );
}

export function Board({ view, isMyTurn, disabled, onMove, settings, t }: FourBoardProps) {
  const { columns, rows } = view.config;
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [pendingCol, setPendingCol] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);

  // A new position (move played, undo, new game) clears the unconfirmed selection.
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setPendingCol(null);
  }

  const canPlay = isMyTurn && !disabled && view.winner === null;
  const winCells = new Set(view.winLine ?? []);
  const pieceName = (p: FourSeat) => t(`games.four-in-a-row.pieces.${p}`);
  // Players count rows from the bottom.
  const coords = (cell: number) => ({ col: (cell % columns) + 1, row: rows - Math.floor(cell / columns) });

  const landingCell = (col: number | null) => {
    if (col === null) return null;
    const row = dropRow(view.board, view.config, col);
    return row < 0 ? null : row * columns + col;
  };
  const ghostCol = settings.confirmMove ? pendingCol : (pendingCol ?? hoverCol);
  const ghostCell = canPlay ? landingCell(ghostCol) : null;

  const activate = (cell: number) => {
    const col = cell % columns;
    if (!canPlay || landingCell(col) === null) return;
    if (settings.confirmMove && pendingCol !== col) {
      setPendingCol(col);
      return;
    }
    setPendingCol(null);
    onMove({ col });
  };

  const lastPiece = view.lastMove === null ? null : view.board[view.lastMove];
  const r = CELL * 0.4;

  return (
    <div className="fiar-board">
      <GridBoard
        rows={rows}
        cols={columns}
        label={t('games.four-in-a-row.boardLabel', { columns, rows })}
        cellLabel={(cell) => {
          const piece = view.board[cell];
          return t('games.four-in-a-row.cellLabel', {
            ...coords(cell),
            piece: piece === null || piece === undefined ? t('games.four-in-a-row.empty') : pieceName(piece),
          });
        }}
        onActivate={activate}
        onHover={(cell) => setHoverCol(cell === null ? null : cell % columns)}
        cellData={(cell) => ({
          'data-piece': view.board[cell] === 0 ? 'p0' : view.board[cell] === 1 ? 'p1' : undefined,
          'data-last': cell === view.lastMove ? 'true' : undefined,
          'data-win': winCells.has(cell) ? 'true' : undefined,
          'data-pending': pendingCol !== null && cell === landingCell(pendingCol) ? 'true' : undefined,
        })}
        renderCell={(cell, geom: CellGeometry) => {
          const piece = view.board[cell];
          const cx = geom.x + geom.size / 2;
          const cy = geom.y + geom.size / 2;
          const row = Math.floor(cell / columns);
          const animate = settings.animations && cell === view.lastMove;
          return (
            <>
              <circle className="fiar-hole" cx={cx} cy={cy} r={r} />
              {piece !== null && piece !== undefined && (
                <Disc
                  piece={piece}
                  cx={cx}
                  cy={cy}
                  r={r}
                  {...(animate
                    ? {
                        className: 'fiar-drop',
                        style: { '--fiar-drop': `${-(row + 1) * CELL}px` } as CSSProperties,
                      }
                    : {})}
                />
              )}
              {cell === ghostCell && <Disc piece={view.turn} cx={cx} cy={cy} r={r} className="fiar-ghost" />}
              {cell === view.lastMove && <circle className="fiar-last" cx={cx} cy={cy} r={r + 1} />}
              {winCells.has(cell) && <circle className="fiar-win" cx={cx} cy={cy} r={r + 1} />}
            </>
          );
        }}
      />
      <VisuallyHidden live>
        {view.lastMove !== null && lastPiece !== null && lastPiece !== undefined
          ? t('games.four-in-a-row.lastMove', { piece: pieceName(lastPiece), ...coords(view.lastMove) })
          : ''}
      </VisuallyHidden>
    </div>
  );
}
