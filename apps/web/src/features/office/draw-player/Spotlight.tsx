'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { centreOf, HerdField } from './HerdField';
import { buildUpSpot, landingSpot } from './spotlight-math';
import type { DrawPhase } from './timeline';

/** Đèn sân khấu: the room goes dark, a light hops over the herd and stops on the winner. */
export function Spotlight({
  draw,
  writer,
  big,
}: {
  draw: OfficeDrawStarted | OfficeDrawRecord;
  writer: RefObject<((p: DrawPhase) => void) | null>;
  big: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const light = useRef<HTMLDivElement>(null);
  const count = draw.candidates.length;

  useEffect(() => {
    let lit = -1;
    writer.current = (p) => {
      const el = light.current;
      if (!el) return;
      const spot =
        p.kind === 'buildUp'
          ? buildUpSpot(draw.drawId, count, p.t)
          : p.kind === 'landing'
            ? landingSpot(p.record, count, p.t)
            : p.kind === 'done'
              ? landingSpot(p.record, count, DRAW_LANDING_MS)
              : null;
      if (!spot) {
        el.style.opacity = '0';
        return;
      }
      const a = cells.current[spot.a];
      const b = cells.current[spot.b];
      if (!a || !b) return;
      const pa = centreOf(a);
      const pb = centreOf(b);
      const x = pa.x + (pb.x - pa.x) * spot.f;
      const y = pa.y + (pb.y - pa.y) * spot.f;
      const r = el.offsetWidth / 2;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${x - r}px, ${y - r}px, 0)`;
      // The animal under the light (the nearer cell) gets a little bounce.
      const now = spot.f < 0.5 ? spot.a : spot.b;
      if (now !== lit) {
        if (lit >= 0) cells.current[lit]?.removeAttribute('data-lit');
        cells.current[now]?.setAttribute('data-lit', 'true');
        lit = now;
      }
    };
    return () => {
      writer.current = null;
    };
  }, [count, draw.drawId, writer]);

  return (
    <HerdField
      candidates={draw.candidates}
      big={big}
      area={area}
      cells={cells}
      className="spotlight"
      testId="draw-spotlight"
    >
      <div ref={light} className="spotlight-light" aria-hidden="true" />
    </HerdField>
  );
}
