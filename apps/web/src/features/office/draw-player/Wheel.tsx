'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { Avatar, type AvatarData } from '@bg/avatars';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { isRevealed, type DrawPhase } from './timeline';
import {
  buildUpAngle,
  groupCount,
  groupedLanding,
  groupRange,
  isGrouped,
  landingAngle,
  WHEEL_GROUP,
} from './wheel-math';

const COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];
const R = 100;

function slice(i: number, count: number): string {
  if (count === 1) return `M0 0 m-${R} 0 a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 -${2 * R} 0`;
  const a0 = ((i / count) * 2 - 0.5) * Math.PI;
  const a1 = (((i + 1) / count) * 2 - 0.5) * Math.PI;
  const large = count === 2 ? 1 : 0;
  return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
}

interface Slice {
  key: string;
  label: string;
  avatar?: AvatarData;
}

/** One wheel: slices clockwise from the top, the pointer at the top. The rotor is turned from outside. */
function WheelSvg({
  slices,
  rotor,
  hidden,
  testId,
}: {
  slices: Slice[];
  rotor: RefObject<SVGGElement | null>;
  hidden?: boolean;
  testId?: string;
}) {
  const count = slices.length;
  const seg = 360 / count;
  const avatars = count <= 16 && slices.some((s) => s.avatar);
  const labels = count <= 24;
  return (
    <svg
      viewBox="-110 -118 220 228"
      className="wheel-svg"
      aria-hidden="true"
      style={hidden ? { display: 'none' } : undefined}
      data-testid={testId}
    >
      <g ref={rotor}>
        {slices.map((s, i) => (
          <g key={s.key}>
            <path
              d={slice(i, count)}
              fill={COLORS[i % COLORS.length]}
              stroke="#0f0d2e"
              strokeWidth={count > 60 ? 0.2 : 0.8}
            />
            {(avatars || labels) && (
              <g transform={`rotate(${(i + 0.5) * seg})`}>
                {avatars && s.avatar && (
                  <g transform={`translate(-11 ${-R + 4})`}>
                    <Avatar avatar={s.avatar} size={22} />
                  </g>
                )}
                {labels && (
                  <text
                    transform={`translate(0 ${avatars ? -R + 32 : -R + 8}) rotate(90)`}
                    className="wheel-name"
                    fontSize={count <= 8 ? 8 : 6}
                  >
                    {s.label.length > 14 ? `${s.label.slice(0, 13)}…` : s.label}
                  </text>
                )}
              </g>
            )}
          </g>
        ))}
      </g>
      <circle r={12} fill="#1e1b4b" stroke="#fde68a" strokeWidth={2} />
      <path d="M0 -96 L-9 -116 L9 -116 Z" fill="#fde68a" stroke="#0f0d2e" strokeWidth={1.5} />
    </svg>
  );
}

const turn = (el: SVGGElement | null, angle: number) =>
  // The SVG attribute turns around the wheel's centre (0, 0), whatever the CSS transform-box.
  el?.setAttribute('transform', `rotate(${angle})`);

/**
 * Vòng quay: one slice per candidate. With more than 60 people it spins groups of 12 first, then the
 * winning group (docs/office/07 §3), so names stay readable.
 */
export function Wheel({
  draw,
  writer,
}: {
  draw: OfficeDrawStarted | OfficeDrawRecord;
  writer: RefObject<((p: DrawPhase) => void) | null>;
}) {
  const rotor = useRef<SVGGElement>(null);
  const members = useRef<SVGGElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const count = draw.candidates.length;
  const grouped = isGrouped(count);
  const record = isRevealed(draw) ? draw : null;

  // With groups, the winning group is known once the result is revealed.
  const winnerGroup = (() => {
    if (!grouped || !record) return null;
    const i = record.candidates.findIndex((c) => c.id === record.winners[0]);
    return Math.floor(i / WHEEL_GROUP);
  })();

  useEffect(() => {
    writer.current = (p) => {
      if (p.kind === 'countdown') return turn(rotor.current, 0);
      if (p.kind === 'buildUp') return turn(rotor.current, buildUpAngle(p.t));
      const t = p.kind === 'landing' ? p.t : DRAW_LANDING_MS;
      if (!grouped) return turn(rotor.current, landingAngle(p.record, count, t));
      const frame = groupedLanding(p.record, count, t);
      const showMembers = frame.stage === 'members';
      if (outer.current) outer.current.dataset.stage = frame.stage;
      rotor.current?.parentElement?.style.setProperty('display', showMembers ? 'none' : '');
      members.current?.parentElement?.style.setProperty('display', showMembers ? '' : 'none');
      turn(showMembers ? members.current : rotor.current, frame.angle);
    };
    return () => {
      writer.current = null;
    };
  }, [count, grouped, writer]);

  const main: Slice[] = grouped
    ? Array.from({ length: groupCount(count) }, (_, g) => ({ key: `g${g}`, label: `#${g + 1}` }))
    : draw.candidates.map((c) => ({ key: c.id, label: c.name, avatar: c.avatar }));

  let memberSlices: Slice[] | null = null;
  if (winnerGroup !== null) {
    const [lo, hi] = groupRange(winnerGroup, count);
    memberSlices = draw.candidates.slice(lo, hi).map((c) => ({ key: c.id, label: c.name, avatar: c.avatar }));
  }

  return (
    <div ref={outer} className="wheel" data-testid="draw-wheel" data-grouped={grouped}>
      <WheelSvg slices={main} rotor={rotor} />
      {memberSlices && <WheelSvg slices={memberSlices} rotor={members} hidden testId="draw-wheel-group" />}
    </div>
  );
}
