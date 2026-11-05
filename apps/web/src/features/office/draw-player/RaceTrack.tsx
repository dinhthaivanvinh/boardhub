'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react';
import { Avatar } from '@bg/avatars';
import { DRAW_LANDING_MS } from '@bg/office-core';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { animalLabel } from '../session/shared';
import { buildUpProgress, landingProgress, raceLanes } from './race-math';
import { isRevealed, type DrawPhase } from './timeline';

/** Đua thú: up to 12 animals run left to right; the winners cross the finish line. */
export function RaceTrack({
  draw,
  writer,
}: {
  draw: OfficeDrawStarted | OfficeDrawRecord;
  writer: RefObject<((p: DrawPhase) => void) | null>;
}) {
  const t = useTranslations('officeSession.draw');
  const tAvatar = useTranslations('avatar');
  const revealed = isRevealed(draw) ? draw : undefined;
  const lanes = useMemo(() => raceLanes(draw, revealed), [draw, revealed]);
  const byId = useMemo(() => new Map(draw.candidates.map((c) => [c.id, c])), [draw]);
  const track = useRef<HTMLDivElement>(null);
  const runners = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    writer.current = (p) => {
      // Lane width minus the runner's own width (runners size with the lanes, see CSS).
      const runner = runners.current[0]?.offsetWidth ?? 0;
      const width = (track.current?.querySelector<HTMLElement>('.race-run')?.clientWidth ?? 0) - runner;
      lanes.forEach((id, lane) => {
        const el = runners.current[lane];
        if (!el) return;
        let x = 0;
        let hop = 0;
        if (p.kind === 'buildUp') {
          x = buildUpProgress(draw.drawId, lane, p.t);
          hop = Math.abs(Math.sin(p.t / 110 + lane));
        } else if (p.kind === 'landing') {
          x = landingProgress(p.record, id, lane, p.t);
          hop = x < 0.999 ? Math.abs(Math.sin(p.t / 110 + lane)) * (1 - p.t / DRAW_LANDING_MS) : 0;
        } else if (p.kind === 'done') {
          x = landingProgress(p.record, id, lane, DRAW_LANDING_MS);
        }
        el.style.transform = `translate3d(${Math.max(0, x * width)}px, ${-hop * 6}px, 0)`;
        el.dataset.finished = p.kind !== 'buildUp' && x > 0.999 ? 'true' : 'false';
      });
    };
    return () => {
      writer.current = null;
    };
  }, [draw, lanes, writer]);

  return (
    <div className="race" data-testid="draw-race">
      <div ref={track} className="race-track" style={{ '--lanes': lanes.length } as CSSProperties}>
        {lanes.map((id, lane) => {
          const c = byId.get(id)!;
          return (
            <div key={`${lane}:${id}`} className="race-lane">
              <span className="race-name">{c.name}</span>
              <div className="race-run">
                <div className="race-finish" aria-hidden="true" />
                <div
                  ref={(el) => {
                    runners.current[lane] = el;
                  }}
                  className="race-runner"
                >
                  <Avatar avatar={c.avatar} size={64} label={animalLabel(tAvatar, c)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {draw.candidates.length > lanes.length && (
        <p className="race-more">{t('moreInDraw', { n: draw.candidates.length - lanes.length })}</p>
      )}
    </div>
  );
}
