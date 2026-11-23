'use client';

import { CELL } from '@bg/ui';
import type { Piece } from '../rules/types';
import { PieceShape } from './pieces';

/** One piece as a standalone icon, for pages that talk about the pieces (the home page). */
export function PieceGlyph({ piece, size = 48 }: { piece: Piece; size?: number }) {
  return (
    <svg viewBox={`0 0 ${CELL} ${CELL}`} width={size} height={size} aria-hidden="true" data-game="chess">
      <PieceShape piece={piece} cx={CELL / 2} cy={CELL / 2 + 1} />
    </svg>
  );
}
