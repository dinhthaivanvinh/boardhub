'use client';

import { CELL, GridBoard, SlidingPiece, type Translator } from '@bg/ui';
import type { ReactNode } from 'react';
import { colOf, FILES, rowOf, squareName } from '../rules/board';
import type { Piece } from '../rules/types';
import { PieceShape } from '../ui/pieces';

const HALF = CELL / 2;

export type LearnBoardProps = {
  board: readonly (Piece | null)[];
  /** Black at the bottom. */
  flipped?: boolean;
  t: Translator;
  animate: boolean;
  selected?: number | null;
  /** Empty squares to mark with a dot. */
  dots?: ReadonlySet<number>;
  /** Squares holding a piece that can be taken. */
  captures?: ReadonlySet<number>;
  /** Squares to light up (last move, hint). */
  marks?: ReadonlySet<number>;
  goal?: number | null;
  /** Draw a star in the goal square ("find the piece that reaches the star"). */
  goalStar?: boolean;
  /** Rank number 1–8 to colour across the board (orange), and file index 0–7 (blue): the two lines of a coordinate. */
  rankLine?: number | null;
  fileLine?: number | null;
  /** A king in check: a red glow under the piece. */
  danger?: number | null;
  /** Increment on every wrong try: replays the shake. */
  shake?: number;
  /** A piece gliding from `from` to `to`; it is drawn at `to`, so leave `to` empty on `board`. */
  slide?: { id: string | number; from: number; to: number; piece: Piece } | null;
  onSquare?(square: number): void;
};

/** The board used by lessons: pieces, dots, hints and one gliding piece. No rules inside. */
export function LearnBoard({
  board,
  flipped = false,
  t,
  animate,
  selected = null,
  dots,
  captures,
  marks,
  goal = null,
  goalStar = false,
  rankLine = null,
  fileLine = null,
  danger = null,
  shake = 0,
  slide = null,
  onSquare,
}: LearnBoardProps) {
  const toBoard = (display: number) => (flipped ? 63 - display : display);
  const centre = (s: number) => {
    const d = flipped ? 63 - s : s;
    return { x: colOf(d) * CELL + HALF, y: rowOf(d) * CELL + HALF };
  };
  const label = (p: Piece) =>
    t('games.chess.pieceLabel', {
      type: t(`games.chess.pieceNames.${p[1]}`),
      color: t(`games.chess.pieces.${p[0] === 'w' ? 0 : 1}`),
    });

  return (
    <div className="ch-learn-frame">
      <div className="ch-learn-ranks" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>{flipped ? i + 1 : 8 - i}</span>
        ))}
      </div>
      <div
        className="ch-board ch-learn-board"
        data-shake={shake > 0 ? (shake % 2 === 1 ? 'a' : 'b') : undefined}
      >
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
            const p = board[s];
            return t('games.chess.cellLabel', {
              square: squareName(s),
              piece: p ? label(p) : t('games.chess.empty'),
            });
          }}
          onActivate={(display) => onSquare?.(toBoard(display))}
          cellData={(display) => {
            const s = toBoard(display);
            return {
              'data-square': squareName(s),
              'data-piece': board[s] ?? undefined,
              'data-target': dots?.has(s) || captures?.has(s) ? 'true' : undefined,
              'data-goal': s === goal ? 'true' : undefined,
            };
          }}
          renderCell={(display, geom) => {
            const s = toBoard(display);
            const p = board[s];
            const cx = geom.x + HALF;
            const cy = geom.y + HALF;
            return (
              <>
                {rankLine !== null && 8 - (s >> 3) === rankLine && (
                  <rect className="ch-rank-line" x={geom.x} y={geom.y} width={CELL} height={CELL} />
                )}
                {fileLine !== null && (s & 7) === fileLine && (
                  <rect className="ch-file-line" x={geom.x} y={geom.y} width={CELL} height={CELL} />
                )}
                {marks?.has(s) && (
                  <rect className="ch-last" x={geom.x} y={geom.y} width={CELL} height={CELL} />
                )}
                {s === selected && (
                  <rect className="ch-selected-sq" x={geom.x} y={geom.y} width={CELL} height={CELL} />
                )}
                {s === danger && <circle className="ch-check-glow" cx={cx} cy={cy} r={CELL * 0.48} />}
                {s === goal && <circle className="ch-goal" cx={cx} cy={cy} r={CELL * 0.4} />}
                {s === goal && goalStar && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={CELL * 0.5}
                    aria-hidden="true"
                    pointerEvents="none"
                  >
                    ⭐
                  </text>
                )}
                {p && <PieceShape piece={p} cx={cx} cy={cy + 1} />}
                {captures?.has(s) && <circle className="ch-capture" cx={cx} cy={cy} r={CELL * 0.44} />}
                {dots?.has(s) && !p && <circle className="ch-target" cx={cx} cy={cy} r={CELL * 0.14} />}
              </>
            );
          }}
          overlay={
            slide ? (
              <SlidingPiece key={slide.id} from={centre(slide.from)} to={centre(slide.to)} animate={animate}>
                <PieceShape piece={slide.piece} cx={centre(slide.to).x} cy={centre(slide.to).y + 1} />
              </SlidingPiece>
            ) : undefined
          }
        />
      </div>
      <div className="ch-learn-files" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>{FILES[flipped ? 7 - i : i]}</span>
        ))}
      </div>
    </div>
  );
}

/** Board on one side, the text and buttons on the other, so nothing needs scrolling on a wide screen. */
export function LessonLayout({ board, children }: { board: ReactNode; children: ReactNode }) {
  return (
    <div className="ch-learn-layout">
      <div className="ch-learn-boardcol">{board}</div>
      <div className="ch-learn-side">{children}</div>
    </div>
  );
}
