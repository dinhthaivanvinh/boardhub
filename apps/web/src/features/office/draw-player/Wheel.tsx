'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { Avatar } from '@bg/avatars';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { type DrawPhase } from './timeline';
import { buildUpAngle, landingAngle } from './wheel-math';

const COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
const R = 100;

function slice(i: number, count: number): string {
  if (count === 1) return `M0 0 m-${R} 0 a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 -${2 * R} 0`;
  const a0 = ((i / count) * 2 - 0.5) * Math.PI;
  const a1 = (((i + 1) / count) * 2 - 0.5) * Math.PI;
  const large = count === 2 ? 1 : 0;
  return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
}

/**
 * Vòng quay: one slice per candidate, clockwise from the top; the pointer is at the top.
 * Big pools get thin slices without labels — the result card names the winner.
 */
export function Wheel({
  draw,
  writer,
}: {
  draw: OfficeDrawStarted | OfficeDrawRecord;
  writer: RefObject<((p: DrawPhase) => void) | null>;
}) {
  const rotor = useRef<SVGGElement>(null);
  const count = draw.candidates.length;
  const avatars = count <= 16;
  const names = count <= 24;

  useEffect(() => {
    writer.current = (p) => {
      const angle =
        p.kind === 'buildUp'
          ? buildUpAngle(p.t)
          : p.kind === 'landing'
            ? landingAngle(p.record, count, p.t)
            : p.kind === 'done'
              ? landingAngle(p.record, count, DRAW_LANDING_MS)
              : 0;
      // The SVG attribute turns around the wheel's centre (0, 0), whatever the CSS transform-box.
      rotor.current?.setAttribute('transform', `rotate(${angle})`);
    };
    return () => {
      writer.current = null;
    };
  }, [count, writer]);

  const seg = 360 / count;
  return (
    <div className="wheel" data-testid="draw-wheel">
      <svg viewBox="-110 -118 220 228" className="wheel-svg" aria-hidden="true">
        <g ref={rotor} className="wheel-rotor">
          {draw.candidates.map((c, i) => {
            const mid = (i + 0.5) * seg;
            return (
              <g key={c.id}>
                <path
                  d={slice(i, count)}
                  fill={COLORS[i % COLORS.length]}
                  stroke="#0f0d2e"
                  strokeWidth={count > 60 ? 0.2 : 0.8}
                />
                {(avatars || names) && (
                  <g transform={`rotate(${mid})`}>
                    {avatars && (
                      <g transform={`translate(-11 ${-R + 4})`}>
                        <Avatar avatar={c.avatar} size={22} />
                      </g>
                    )}
                    {names && (
                      <text
                        transform={`translate(0 ${avatars ? -R + 32 : -R + 8}) rotate(90)`}
                        className="wheel-name"
                        fontSize={count <= 8 ? 8 : 6}
                      >
                        {c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
        <circle r={12} fill="#1e1b4b" stroke="#fde68a" strokeWidth={2} />
        <path d="M0 -96 L-9 -116 L9 -116 Z" fill="#fde68a" stroke="#0f0d2e" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
