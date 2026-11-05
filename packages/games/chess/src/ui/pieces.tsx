import type { Piece, PieceType } from '../rules/types';

/** Simple, solid silhouettes in a 40 × 40 box around (0, 0). */
const SHAPES: Record<PieceType, string> = {
  P: 'M-4.5 -9a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0M-3.5 -4.5h7l3 12h-13zM-9 8h18a1.5 1.5 0 0 1 1.5 1.5v3.5h-21v-3.5a1.5 1.5 0 0 1 1.5 -1.5z',
  R: 'M-9 -14h4v3h2.5v-3h5v3h2.5v-3h4v7h-18zM-7 -7h14l1 15h-16zM-10.5 8h21v5h-21z',
  N: 'M-9 13v-4.5c0-5 5-6.5 6.5-11l-5 3.5l-4-2.5l8.5-10.5l1-4l3 3c6.5 2 9.5 8 9.5 15v11zM-10.5 9.5h21v3.5h-21z',
  B: 'M0 -16a2.4 2.4 0 1 0 0.01 0zM0 -12c-5 4.5-7 8.5-6 12.5c0.6 2.6 2.5 3.5 2.5 3.5h7s1.9-0.9 2.5-3.5c1-4-1-8-6-12.5zM-7 4h14v3h-14zM-10 8h20v5h-20z',
  Q: 'M-11 -8l3.5 14h15l3.5-14l-6 6l-3-10l-3 10l-3-10l-3 10zM-12 -9.5a2 2 0 1 0 0.01 0zM12 -9.5a2 2 0 1 0 0.01 0zM-4 -12.5a2 2 0 1 0 0.01 0zM4 -12.5a2 2 0 1 0 0.01 0zM-9 6h18v3h-18zM-10.5 9h21v4h-21z',
  K: 'M-1.5 -17h3v3h3v3h-3v3h-3v-3h-3v-3h3zM-8.5 6c-2.5-5-1.5-11 8.5-13c10 2 11 8 8.5 13zM-9 6h18v3h-18zM-10.5 9h21v4h-21z',
};

export function PieceShape({
  piece,
  cx,
  cy,
  className,
}: {
  piece: Piece;
  cx: number;
  cy: number;
  className?: string;
}) {
  return (
    <path
      d={SHAPES[piece[1] as PieceType]}
      transform={`translate(${cx} ${cy})`}
      className={['ch-piece', piece[0] === 'w' ? 'ch-white' : 'ch-black', className]
        .filter(Boolean)
        .join(' ')}
      data-piece-shape={piece}
    />
  );
}
