'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { buildUpClaw, landingClaw } from './claw-math';
import { HerdField } from './HerdField';
import type { DrawPhase } from './timeline';

/** Height of the claw head (px), shared with the CSS. */
const HEAD = 44;

/** Máy gắp thú: a claw slides above the herd, then drops on the winner and lifts them up. */
export function ClawMachine({
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
  const claw = useRef<HTMLDivElement>(null);
  const cable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let held: HTMLElement | null = null;
    writer.current = (p) => {
      const box = area.current;
      if (!box || !claw.current || !cable.current) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      let c = { x: 0.5, y: 0, holding: false };
      let cell: HTMLElement | null = null;
      if (p.kind === 'buildUp') c = buildUpClaw(draw.drawId, p.t);
      if (p.kind === 'landing' || p.kind === 'done') {
        const i = p.record.candidates.findIndex((x) => x.id === p.record.winners[0]);
        cell = cells.current[i] ?? null;
        if (cell) {
          // The claw's tips reach a third of the way into the winner's animal.
          const target = {
            x: (cell.offsetLeft + cell.offsetWidth / 2) / w,
            y: Math.max(0, cell.offsetTop + cell.offsetHeight * 0.3 - HEAD) / h,
          };
          c = landingClaw(draw.drawId, target, p.kind === 'landing' ? p.t : DRAW_LANDING_MS);
          if (c.holding) {
            cell.style.transform = `translate3d(0, ${-(target.y - c.y) * h}px, 0)`;
            cell.dataset.held = 'true';
            held = cell;
          }
        }
      }
      if (held && held !== cell) {
        held.style.transform = '';
        delete held.dataset.held;
        held = null;
      }
      claw.current.style.transform = `translate3d(${c.x * w - HEAD / 2}px, 0, 0)`;
      cable.current.style.height = `${c.y * h}px`;
      claw.current.dataset.closed = c.holding ? 'true' : 'false';
    };
    return () => {
      writer.current = null;
    };
  }, [draw.drawId, writer]);

  return (
    <HerdField
      candidates={draw.candidates}
      big={big}
      area={area}
      cells={cells}
      className="claw-machine"
      testId="draw-claw"
    >
      <div className="claw-rail" aria-hidden="true" />
      <div ref={claw} className="claw" aria-hidden="true">
        <div ref={cable} className="claw-cable" />
        <svg className="claw-head" viewBox="0 0 44 44" width={HEAD} height={HEAD}>
          <rect x="14" y="0" width="16" height="12" rx="3" fill="#94a3b8" />
          <path className="claw-arm claw-arm-l" d="M18 10 L6 28 L12 42" />
          <path className="claw-arm claw-arm-r" d="M26 10 L38 28 L32 42" />
        </svg>
      </div>
    </HerdField>
  );
}
