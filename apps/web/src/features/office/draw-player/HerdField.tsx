'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Avatar } from '@bg/avatars';
import type { OfficeDrawCandidate } from '@bg/protocol';
import { animalLabel } from '../session/shared';

/** Animal size in the herd field, by head count and screen. */
export function fieldSize(count: number, big: boolean): number {
  const base = count <= 12 ? 120 : count <= 60 ? 76 : 44;
  return big ? base : Math.round(base * 0.55);
}

/**
 * Everyone in the draw as a grid of animals, for the modes that play over the herd (spotlight, claw).
 * `cells[i]` is candidate i's element, positioned inside `area` (which is `position: relative`).
 */
export function HerdField({
  candidates,
  big,
  area,
  cells,
  children,
  className,
  testId,
}: {
  candidates: OfficeDrawCandidate[];
  big: boolean;
  area: RefObject<HTMLDivElement | null>;
  cells: RefObject<(HTMLDivElement | null)[]>;
  children?: ReactNode;
  className: string;
  testId: string;
}) {
  const tAvatar = useTranslations('avatar');
  const size = fieldSize(candidates.length, big);
  const names = candidates.length <= 60;
  return (
    <div
      ref={area}
      className={`herd-field ${className}`}
      data-testid={testId}
      style={{ '--cell': `${size}px` } as CSSProperties}
    >
      <div className="herd-field-grid">
        {candidates.map((c, i) => (
          <div
            key={c.id}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className="herd-field-cell"
          >
            <Avatar avatar={c.avatar} size={size} label={animalLabel(tAvatar, c)} />
            {names && <span className="herd-field-name">{c.name}</span>}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

/** Centre of an element inside its offset parent. */
export const centreOf = (el: HTMLElement) => ({
  x: el.offsetLeft + el.offsetWidth / 2,
  y: el.offsetTop + el.offsetHeight / 2,
});
