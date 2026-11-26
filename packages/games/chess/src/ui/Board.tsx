'use client';

import { useState } from 'react';
import { CELL, GridBoard, SlidingPiece, VisuallyHidden, type BoardProps } from '@bg/ui';
import { colOf, FILES, kingSquare, rowOf, squareName } from '../rules/board';
import { colorOfSeat, legalMoves } from '../rules/rules';
import type { ChessMove, ChessState, Piece, PieceType, Promotion } from '../rules/types';
import { PieceShape } from './pieces';

export type ChessBoardProps = BoardProps<ChessState, ChessMove>;

const HALF = CELL / 2;
const PROMOTIONS: Promotion[] = ['Q', 'R', 'B', 'N'];

export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox={`0 0 ${CELL} ${CELL}`} width={size} height={size} aria-hidden="true">
      <PieceShape piece={seat === 0 ? 'wK' : 'bK'} cx={HALF} cy={HALF + 1} />
    </svg>
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
  assist,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<{ from: number; to: number } | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(view.moveCount);
  if (seenMoveCount !== view.moveCount) {
    setSeenMoveCount(view.moveCount);
    setSelected(null);
    setPromoting(null);
  }

  // Black sits at the bottom when playing Black: the board is turned round.
  const flipped = (orientation ?? mySeat ?? 0) === 1;
  const toBoard = (display: number) => (flipped ? 63 - display : display);
  const displayOf = toBoard;

  const canPlay = isMyTurn && !disabled && view.status === 'playing' && mySeat !== null;
  const myColor = colorOfSeat(mySeat ?? 0);
  const moves = canPlay ? legalMoves(view, mySeat) : [];
  const movable = new Set(moves.map((m) => m.from));
  const targets = new Set(selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to));
  const checkedKing = view.inCheck === null ? -1 : kingSquare(view.board, colorOfSeat(view.inCheck));
  const last = view.lastMove;
  const warned = new Set(assist?.warn);
  const hinted = new Set(assist?.hint);

  const pieceLabel = (p: Piece) =>
    t('games.chess.pieceLabel', {
      type: t(`games.chess.pieceNames.${p[1]}`),
      color: t(`games.chess.pieces.${p[0] === 'w' ? 0 : 1}`),
    });
  const centre = (s: number) => {
    const d = displayOf(s);
    return { x: colOf(d) * CELL + HALF, y: rowOf(d) * CELL + HALF };
  };

  const activate = (display: number) => {
    if (!canPlay || promoting) return;
    const s = toBoard(display);
    if (selected !== null && targets.has(s)) {
      const options = moves.filter((m) => m.from === selected && m.to === s);
      if (options.some((m) => m.promotion)) {
        setPromoting({ from: selected, to: s });
        return;
      }
      setSelected(null);
      onMove({ from: selected, to: s });
      return;
    }
    const p = view.board[s];
    setSelected(p && p[0] === myColor && movable.has(s) && s !== selected ? s : null);
  };

  // The moved piece (and the rook when castling) slide in; they are drawn in the overlay, not in their squares.
  const rookMove =
    last?.castle === 'K'
      ? { from: last.to + 1, to: last.to - 1 }
      : last?.castle === 'Q'
        ? { from: last.to - 2, to: last.to + 1 }
        : null;
  const sliding = new Set(last ? [last.to, ...(rookMove ? [rookMove.to] : [])] : []);
  const pieceClass = (s: number) =>
    [s === selected && 'ch-selected', s === checkedKing && 'ch-check'].filter(Boolean).join(' ');

  const lastText = last
    ? [
        last.castle
          ? t(`games.chess.castle${last.castle}`, {
              color: t(`games.chess.pieces.${last.piece[0] === 'w' ? 0 : 1}`),
            })
          : t('games.chess.lastMove', {
              piece: pieceLabel(last.piece),
              from: squareName(last.from),
              to: squareName(last.to),
            }),
        last.captured ? t('games.chess.captures', { piece: pieceLabel(last.captured) }) : '',
        last.promotion
          ? t('games.chess.promotes', { piece: t(`games.chess.pieceNames.${last.promotion}`) })
          : '',
        view.inCheck !== null && view.status === 'playing' ? t('games.chess.check') : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div className="ch-learn-frame">
      <div className="ch-learn-ranks" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>{flipped ? i + 1 : 8 - i}</span>
        ))}
      </div>
      <div className="ch-board">
        <GridBoard
          rows={8}
          cols={8}
          gridLines={false}
          label={t('games.chess.boardLabel')}
          background={
            <g>
              {Array.from({ length: 64 }, (_, d) => (
                <rect
                  key={d}
                  x={colOf(d) * CELL}
                  y={rowOf(d) * CELL}
                  width={CELL}
                  height={CELL}
                  className={(rowOf(d) + colOf(d)) % 2 === 0 ? 'ch-light' : 'ch-dark'}
                />
              ))}
            </g>
          }
          cellLabel={(display) => {
            const s = toBoard(display);
            const p = view.board[s];
            const label = t('games.chess.cellLabel', {
              square: squareName(s),
              piece: p ? pieceLabel(p) : t('games.chess.empty'),
            });
            const notes = [
              warned.has(s) ? t('games.chess.coach.cellThreatened') : '',
              hinted.has(s) ? t('games.chess.coach.cellHint') : '',
            ].filter(Boolean);
            return notes.length > 0 ? `${label}, ${notes.join(', ')}` : label;
          }}
          onActivate={activate}
          cellData={(display) => {
            const s = toBoard(display);
            return {
              'data-square': squareName(s),
              'data-piece': view.board[s] ?? undefined,
              'data-selected': s === selected ? 'true' : undefined,
              'data-target': targets.has(s) ? 'true' : undefined,
              'data-last': last && (s === last.from || s === last.to) ? 'true' : undefined,
              'data-check': s === checkedKing ? 'true' : undefined,
              'data-threatened': warned.has(s) ? 'true' : undefined,
              'data-hint': hinted.has(s) ? 'true' : undefined,
            };
          }}
          renderCell={(display, geom) => {
            const s = toBoard(display);
            const p = view.board[s];
            const cx = geom.x + HALF;
            const cy = geom.y + HALF;
            const isLast = last && (s === last.from || s === last.to);
            return (
              <>
                {isLast && <rect className="ch-last" x={geom.x} y={geom.y} width={CELL} height={CELL} />}
                {s === checkedKing && <circle className="ch-check-glow" cx={cx} cy={cy} r={CELL * 0.48} />}
                {s === selected && (
                  <rect className="ch-selected-sq" x={geom.x} y={geom.y} width={CELL} height={CELL} />
                )}
                {hinted.has(s) && (
                  <rect
                    className="ch-hint"
                    x={geom.x + 3}
                    y={geom.y + 3}
                    width={CELL - 6}
                    height={CELL - 6}
                  />
                )}
                {p && !sliding.has(s) && (
                  <PieceShape piece={p} cx={cx} cy={cy + 1} className={pieceClass(s)} />
                )}
                {targets.has(s) &&
                  (p || (last && view.enPassant === s) ? (
                    <circle className="ch-capture" cx={cx} cy={cy} r={CELL * 0.44} />
                  ) : (
                    <circle className="ch-target" cx={cx} cy={cy} r={CELL * 0.14} />
                  ))}
              </>
            );
          }}
          overlay={
            last || warned.size > 0 ? (
              <>
                {rookMove && view.board[rookMove.to] && (
                  <SlidingPiece
                    key={`r${view.moveCount}`}
                    from={centre(rookMove.from)}
                    to={centre(rookMove.to)}
                    animate={settings.animations}
                  >
                    <PieceShape
                      piece={view.board[rookMove.to]!}
                      cx={centre(rookMove.to).x}
                      cy={centre(rookMove.to).y + 1}
                    />
                  </SlidingPiece>
                )}
                {last && view.board[last.to] && (
                  <SlidingPiece
                    key={view.moveCount}
                    from={centre(last.from)}
                    to={centre(last.to)}
                    animate={settings.animations}
                  >
                    <PieceShape
                      piece={view.board[last.to]!}
                      cx={centre(last.to).x}
                      cy={centre(last.to).y + 1}
                      className={pieceClass(last.to)}
                    />
                  </SlidingPiece>
                )}
                {[...warned].map((s) => {
                  const { x, y } = centre(s);
                  return (
                    <g key={`warn${s}`} className="ch-warn" aria-hidden="true" pointerEvents="none">
                      <circle className="ch-warn-ring" cx={x} cy={y} r={CELL * 0.46} />
                      <circle
                        className="ch-warn-badge"
                        cx={x + CELL * 0.31}
                        cy={y - CELL * 0.31}
                        r={CELL * 0.16}
                      />
                      <text
                        x={x + CELL * 0.31}
                        y={y - CELL * 0.31}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        !
                      </text>
                    </g>
                  );
                })}
              </>
            ) : undefined
          }
        />

        {promoting && (
          <div className="ch-promotion" role="dialog" aria-label={t('games.chess.promoteTo')}>
            <p className="ch-promotion-title">{t('games.chess.promoteTo')}</p>
            <div className="ch-promotion-options">
              {PROMOTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="ch-promotion-btn"
                  aria-label={t(`games.chess.pieceNames.${type}`)}
                  onClick={() => {
                    const move = { from: promoting.from, to: promoting.to, promotion: type };
                    setPromoting(null);
                    setSelected(null);
                    onMove(move);
                  }}
                >
                  <svg viewBox={`0 0 ${CELL} ${CELL}`} width="48" height="48" aria-hidden="true">
                    <PieceShape piece={`${myColor}${type as PieceType}` as Piece} cx={HALF} cy={HALF + 1} />
                  </svg>
                </button>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => setPromoting(null)}>
              {t('games.chess.cancel')}
            </button>
          </div>
        )}

        <VisuallyHidden live>{lastText}</VisuallyHidden>
      </div>
      <div className="ch-learn-files" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>{FILES[flipped ? 7 - i : i]}</span>
        ))}
      </div>
    </div>
  );
}
