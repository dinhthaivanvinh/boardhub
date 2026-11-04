'use client';

import { useState } from 'react';
import { GridBoard, VisuallyHidden, type BoardProps, type CellGeometry } from '@bg/ui';
import { countDiscs, legalCells } from '../rules/board';
import type { ReversiMove, ReversiSeat, ReversiState } from '../rules/types';

export type ReversiBoardProps = BoardProps<ReversiState, ReversiMove>;

function Disc({ piece, cell, className }: { piece: ReversiSeat; cell: CellGeometry; className?: string }) {
  const cx = cell.x + cell.size / 2;
  const cy = cell.y + cell.size / 2;
  return (
    <circle
      className={[`rv-p${piece}`, className].filter(Boolean).join(' ')}
      cx={cx}
      cy={cy}
      r={cell.size * 0.4}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

/** Small disc used outside the board (player cards). */
export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <Disc piece={seat === 0 ? 0 : 1} cell={{ x: 0, y: 0, size: 40 }} />
    </svg>
  );
}

export function Board({ view, isMyTurn, disabled, onMove, settings, t }: ReversiBoardProps) {
  const { size } = view.config;
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setPending(null);
  }

  const canPlay = isMyTurn && !disabled && !view.over;
  const legal = new Set(canPlay ? legalCells(view.board, size, view.turn) : []);
  const flipped = new Set(view.flipped);
  const [black, white] = countDiscs(view.board);
  const pieceName = (p: ReversiSeat) => t(`games.reversi.pieces.${p}`);
  const coords = (cell: number) => ({ row: Math.floor(cell / size) + 1, col: (cell % size) + 1 });

  const activate = (cell: number) => {
    if (!legal.has(cell)) return;
    if (settings.confirmMove && pending !== cell) {
      setPending(cell);
      return;
    }
    setPending(null);
    onMove({ cell });
  };

  return (
    <div className="rv-board">
      <p className="rv-score" aria-label={t('games.reversi.score', { black, white })}>
        <span>
          <PieceIcon seat={0} size={18} /> {black}
        </span>
        <span>
          <PieceIcon seat={1} size={18} /> {white}
        </span>
      </p>
      <GridBoard
        rows={size}
        cols={size}
        label={t('games.reversi.boardLabel', { size })}
        cellLabel={(cell) => {
          const piece = view.board[cell];
          const state =
            piece === null || piece === undefined
              ? legal.has(cell)
                ? t('games.reversi.playable')
                : t('games.reversi.empty')
              : pieceName(piece);
          return t('games.reversi.cellLabel', { ...coords(cell), piece: state });
        }}
        onActivate={activate}
        onHover={setHover}
        cellData={(cell) => ({
          'data-piece': view.board[cell] === 0 ? 'p0' : view.board[cell] === 1 ? 'p1' : undefined,
          'data-last': cell === view.lastMove ? 'true' : undefined,
          'data-legal': legal.has(cell) ? 'true' : undefined,
          'data-pending': cell === pending ? 'true' : undefined,
        })}
        renderCell={(cell, geom) => {
          const piece = view.board[cell];
          const cx = geom.x + geom.size / 2;
          const cy = geom.y + geom.size / 2;
          const ghost = legal.has(cell) && (cell === pending || (cell === hover && !settings.confirmMove));
          return (
            <>
              {piece !== null && piece !== undefined && (
                <Disc
                  piece={piece}
                  cell={geom}
                  {...(settings.animations && (flipped.has(cell) || cell === view.lastMove)
                    ? { className: flipped.has(cell) ? 'rv-flip' : 'rv-enter' }
                    : {})}
                />
              )}
              {cell === view.lastMove && <circle className="rv-last" cx={cx} cy={cy} r={geom.size * 0.08} />}
              {ghost && <Disc piece={view.turn} cell={geom} className="rv-ghost" />}
              {!ghost && legal.has(cell) && settings.showLegalMoves && (
                <circle className="rv-hint" cx={cx} cy={cy} r={geom.size * 0.12} />
              )}
            </>
          );
        }}
      />
      <VisuallyHidden live>
        {view.passed !== null && !view.over
          ? t('games.reversi.passed', { piece: pieceName(view.passed) })
          : ''}
      </VisuallyHidden>
      {view.passed !== null && !view.over && (
        <p className="rv-pass" role="note">
          {t('games.reversi.passed', { piece: pieceName(view.passed) })}
        </p>
      )}
    </div>
  );
}
