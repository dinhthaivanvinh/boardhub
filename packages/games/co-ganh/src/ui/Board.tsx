'use client';

import { useState } from 'react';
import { CELL, GridBoard, VisuallyHidden, type BoardProps } from '@bg/ui';
import { isStrongPoint, POINTS, SIZE } from '../rules/board';
import { legalMoves } from '../rules/rules';
import type { CoGanhMove, CoGanhSeat, CoGanhState } from '../rules/types';

export type CoGanhBoardProps = BoardProps<CoGanhState, CoGanhMove>;

const HALF = CELL / 2;

function Stone({
  seat,
  cx,
  cy,
  className,
}: {
  seat: CoGanhSeat;
  cx: number;
  cy: number;
  className?: string;
}) {
  return (
    <g className={[`cg-stone cg-p${seat}`, className].filter(Boolean).join(' ')}>
      <circle cx={cx} cy={cy} r={CELL * 0.36} className="cg-stone-body" />
      <circle cx={cx - CELL * 0.1} cy={cy - CELL * 0.11} r={CELL * 0.1} className="cg-stone-shine" />
    </g>
  );
}

export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox={`0 0 ${CELL} ${CELL}`} width={size} height={size} aria-hidden="true">
      <Stone seat={seat === 0 ? 0 : 1} cx={HALF} cy={HALF} />
    </svg>
  );
}

/** Orthogonal lines everywhere, diagonals through the strong points. Symmetric under a half turn. */
function Lines() {
  const at = (i: number) => i * CELL + HALF;
  const end = at(SIZE - 1);
  const start = at(0);
  return (
    <g className="cg-lines">
      {Array.from({ length: SIZE }, (_, i) => (
        <g key={i}>
          <line x1={start} y1={at(i)} x2={end} y2={at(i)} />
          <line x1={at(i)} y1={start} x2={at(i)} y2={end} />
        </g>
      ))}
      {/* Diagonals of the whole board and of the four half-size squares. */}
      <line x1={start} y1={start} x2={end} y2={end} />
      <line x1={end} y1={start} x2={start} y2={end} />
      <polygon points={`${at(2)},${start} ${end},${at(2)} ${at(2)},${end} ${start},${at(2)}`} fill="none" />
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
}: CoGanhBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setSelected(null);
  }

  // Blue sees the board turned round, with its own pieces at the bottom.
  const flipped = (orientation ?? mySeat ?? 0) === 1;
  const toBoard = (display: number) => (flipped ? POINTS - 1 - display : display);
  const displayOf = toBoard;

  const canPlay = isMyTurn && !disabled && view.status === 'playing' && mySeat !== null;
  const moves = canPlay ? legalMoves(view, mySeat) : [];
  const movable = new Set(moves.map((m) => m.from));
  const targets = new Set(selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to));
  const changed = new Set([...view.carried, ...view.surrounded]);
  const last = view.lastMove;

  const coords = (display: number) => ({ col: (display % SIZE) + 1, row: SIZE - Math.floor(display / SIZE) });
  const name = (display: number) => {
    const { col, row } = coords(display);
    return `${col}-${row}`;
  };

  const activate = (display: number) => {
    if (!canPlay) return;
    const p = toBoard(display);
    if (selected !== null && targets.has(p)) {
      setSelected(null);
      onMove({ from: selected, to: p });
      return;
    }
    setSelected(movable.has(p) && p !== selected ? p : null);
  };

  const mover = last ? view.board[last.to] : null;

  return (
    <div className="cg-board">
      <GridBoard
        rows={SIZE}
        cols={SIZE}
        gridLines={false}
        background={<Lines />}
        label={t('games.co-ganh.boardLabel')}
        cellLabel={(display) => {
          const v = view.board[toBoard(display)];
          return t('games.co-ganh.cellLabel', {
            ...coords(display),
            piece: v === null || v === undefined ? t('games.co-ganh.empty') : t(`games.co-ganh.pieces.${v}`),
          });
        }}
        onActivate={activate}
        cellData={(display) => {
          const p = toBoard(display);
          const v = view.board[p];
          return {
            'data-piece': v === null || v === undefined ? undefined : String(v),
            'data-strong': isStrongPoint(p) ? 'true' : undefined,
            'data-selected': p === selected ? 'true' : undefined,
            'data-target': targets.has(p) ? 'true' : undefined,
            'data-last': last && (p === last.from || p === last.to) ? 'true' : undefined,
            'data-changed': changed.has(p) ? 'true' : undefined,
            'data-forced': view.forced === p ? 'true' : undefined,
          };
        }}
        renderCell={(display, geom) => {
          const p = toBoard(display);
          const v = view.board[p];
          const cx = geom.x + HALF;
          const cy = geom.y + HALF;
          const isLast = last && (p === last.from || p === last.to);
          return (
            <>
              {isLast && <circle className="cg-last" cx={cx} cy={cy} r={CELL * 0.44} />}
              {view.forced === p && <circle className="cg-forced" cx={cx} cy={cy} r={CELL * 0.4} />}
              {v !== null && v !== undefined && (
                <Stone
                  seat={v}
                  cx={cx}
                  cy={cy}
                  className={[
                    p === selected && 'cg-selected',
                    settings.animations && changed.has(p) && 'cg-flip',
                    settings.animations && last && p === last.to && 'cg-enter',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )}
              {targets.has(p) && <circle className="cg-target" cx={cx} cy={cy} r={CELL * 0.12} />}
            </>
          );
        }}
      />
      {canPlay && view.forced !== null && (
        <p className="cg-note" role="status">
          {t('games.co-ganh.mustOpen')}
        </p>
      )}
      <VisuallyHidden live>
        {last && mover !== null && mover !== undefined
          ? [
              t('games.co-ganh.lastMove', {
                color: t(`games.co-ganh.pieces.${mover}`),
                from: name(displayOf(last.from)),
                to: name(displayOf(last.to)),
              }),
              view.carried.length > 0 ? t('games.co-ganh.carried', { n: view.carried.length }) : '',
              view.surrounded.length > 0 ? t('games.co-ganh.surrounded', { n: view.surrounded.length }) : '',
            ]
              .filter(Boolean)
              .join(' ')
          : ''}
      </VisuallyHidden>
    </div>
  );
}
