import type { CSSProperties, ReactNode } from 'react';

export interface Point {
  x: number;
  y: number;
}

/**
 * A piece drawn at `to` that glides there from `from` (viewBox units) when it mounts.
 * Give it a `key` that changes with every move (e.g. the move count) so the slide plays once per move.
 * Render it in GridBoard's `overlay` so it passes over the other pieces. Styles: `.bg-slide` (apps/web).
 */
export function SlidingPiece({
  from,
  to,
  animate,
  children,
}: {
  from: Point;
  to: Point;
  animate: boolean;
  children: ReactNode;
}) {
  const style = {
    '--bg-slide-dx': `${from.x - to.x}px`,
    '--bg-slide-dy': `${from.y - to.y}px`,
  } as CSSProperties;
  return (
    <g className={animate ? 'bg-slide' : undefined} style={style} data-sliding={animate ? 'true' : undefined}>
      {children}
    </g>
  );
}
