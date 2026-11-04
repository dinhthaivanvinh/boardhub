'use client';

import { useState } from 'react';
import { CELL, GridBoard, VisuallyHidden, type BoardProps, type CellGeometry } from '@bg/ui';
import type { CaroMove, CaroSeat, CaroState } from '../rules/types';

export type CaroBoardProps = BoardProps<CaroState, CaroMove>;

function Piece({
  piece,
  cell,
  ghost,
  animate,
}: {
  piece: CaroSeat;
  cell: CellGeometry;
  ghost?: boolean;
  animate?: boolean;
}) {
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  const r = cell.size * 0.28;
  const className = [piece === 0 ? 'caro-x' : 'caro-o', ghost && 'caro-ghost', animate && 'caro-enter']
    .filter(Boolean)
    .join(' ');
  if (piece === 0) {
    return (
      <g className={className} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
        <line x1={cx + r} y1={cy - r} x2={cx - r} y2={cy + r} />
      </g>
    );
  }
  return (
    <circle className={className} cx={cx} cy={cy} r={r} style={{ transformOrigin: `${cx}px ${cy}px` }} />
  );
}

/** Small piece used outside the board (player cards). */
export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <Piece piece={seat === 0 ? 0 : 1} cell={{ x: 0, y: 0, size: 40 }} />
    </svg>
  );
}

export function Board({ view, isMyTurn, disabled, onMove, settings, t }: CaroBoardProps) {
  const { size } = view.config;
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);

  // A new position (move played, undo, new game) clears the unconfirmed selection.
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setPending(null);
  }

  const canPlay = isMyTurn && !disabled && view.winner === null;
  const winCells = new Set(view.winLine ?? []);
  const pieceName = (p: CaroSeat) => t(`games.caro.pieces.${p}`);
  const coords = (cell: number) => ({ row: Math.floor(cell / size) + 1, col: (cell % size) + 1 });

  const activate = (cell: number) => {
    if (!canPlay || view.board[cell] !== null) return;
    if (settings.confirmMove && pending !== cell) {
      setPending(cell);
      return;
    }
    setPending(null);
    onMove({ cell });
  };

  const centre = (cell: number) => ({
    x: (cell % size) * CELL + CELL / 2,
    y: Math.floor(cell / size) * CELL + CELL / 2,
  });
  const line = view.winLine;
  const lastPiece = view.lastMove === null ? null : view.board[view.lastMove];

  return (
    <div className="caro-board">
      <GridBoard
        rows={size}
        cols={size}
        label={t('games.caro.boardLabel', { size })}
        cellLabel={(cell) => {
          const piece = view.board[cell];
          return t('games.caro.cellLabel', {
            ...coords(cell),
            piece: piece === null || piece === undefined ? t('games.caro.empty') : pieceName(piece),
          });
        }}
        onActivate={activate}
        onHover={setHover}
        cellData={(cell) => ({
          'data-piece': view.board[cell] === 0 ? 'x' : view.board[cell] === 1 ? 'o' : undefined,
          'data-last': cell === view.lastMove ? 'true' : undefined,
          'data-win': winCells.has(cell) ? 'true' : undefined,
          'data-pending': cell === pending ? 'true' : undefined,
        })}
        renderCell={(cell, geom) => {
          const piece = view.board[cell];
          const showGhost =
            canPlay && piece === null && (cell === pending || (cell === hover && !settings.confirmMove));
          return (
            <>
              {cell === view.lastMove && (
                <rect className="caro-last" x={geom.x} y={geom.y} width={geom.size} height={geom.size} />
              )}
              {winCells.has(cell) && (
                <rect className="caro-win" x={geom.x} y={geom.y} width={geom.size} height={geom.size} />
              )}
              {piece !== null && piece !== undefined && (
                <Piece piece={piece} cell={geom} animate={settings.animations && cell === view.lastMove} />
              )}
              {showGhost && <Piece piece={view.turn} cell={geom} ghost />}
              {cell === pending && (
                <rect
                  className="caro-pending"
                  x={geom.x + 2}
                  y={geom.y + 2}
                  width={geom.size - 4}
                  height={geom.size - 4}
                />
              )}
            </>
          );
        }}
        overlay={
          line && line.length > 1 ? (
            <line
              className="caro-win-line"
              x1={centre(line[0]!).x}
              y1={centre(line[0]!).y}
              x2={centre(line[line.length - 1]!).x}
              y2={centre(line[line.length - 1]!).y}
            />
          ) : null
        }
      />
      <VisuallyHidden live>
        {view.lastMove !== null && lastPiece !== null && lastPiece !== undefined
          ? t('games.caro.lastMove', { piece: pieceName(lastPiece), ...coords(view.lastMove) })
          : ''}
      </VisuallyHidden>
    </div>
  );
}
