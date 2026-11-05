'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Avatar } from '@bg/avatars';
import type { OfficeDrawRecord, OfficeDrawStarted } from '@bg/protocol';
import { animalLabel } from '../session/shared';
import { ClawMachine } from './ClawMachine';
import { RaceTrack } from './RaceTrack';
import { playWin, startDrumroll } from './sounds';
import { Spotlight } from './Spotlight';
import type { DrawPhase } from './timeline';
import { useDrawAnimations, useDrawClock } from './use-draw-clock';
import { Wheel } from './Wheel';

/**
 * Plays one draw in sync with every other screen: countdown → build-up → landing → winner card.
 * Without animations (reduced motion, or "Animations" off) the result simply appears at the reveal.
 */
export function DrawPlayer({
  code,
  draw,
  serverOffset,
  big = false,
  sound = false,
}: {
  code: string;
  draw: OfficeDrawStarted | OfficeDrawRecord;
  serverOffset: number;
  /** The projector: huge names, readable from the back of the room. */
  big?: boolean;
  /** Drumroll and "ting" (stage and host only, when the sound is on). */
  sound?: boolean;
}) {
  const t = useTranslations('officeSession.draw');
  const animate = useDrawAnimations();
  const writer = useRef<((p: DrawPhase) => void) | null>(null);
  const phase = useDrawClock(draw, serverOffset, animate, (p) => writer.current?.(p));
  useDrawSounds(phase.kind, sound);

  return (
    <div
      className={big ? 'draw-player draw-player-big' : 'draw-player'}
      data-testid="draw-player"
      data-phase={phase.kind}
    >
      {phase.kind !== 'done' && (
        <>
          <p className="draw-status" role="status">
            {phase.kind === 'countdown' && animate ? (
              <span className="draw-countdown" key={Math.ceil(phase.msLeft / 1000)}>
                {Math.max(1, Math.ceil(phase.msLeft / 1000))}
              </span>
            ) : (
              t('drawing')
            )}
          </p>
          {animate && modeView(draw, writer, big)}
        </>
      )}
      <div aria-live="assertive">
        {phase.kind === 'done' && <WinnerCard code={code} record={phase.record} big={big} />}
      </div>
    </div>
  );
}

function modeView(
  draw: OfficeDrawStarted | OfficeDrawRecord,
  writer: RefObject<((p: DrawPhase) => void) | null>,
  big: boolean,
): ReactNode {
  switch (draw.mode) {
    case 'wheel':
      return <Wheel draw={draw} writer={writer} />;
    case 'spotlight':
      return <Spotlight draw={draw} writer={writer} big={big} />;
    case 'claw':
      return <ClawMachine draw={draw} writer={writer} big={big} />;
    default:
      return <RaceTrack draw={draw} writer={writer} />;
  }
}

/**
 * Drumroll while the draw runs, "ting" when it lands — only for phases that happen while this screen
 * watches (opening a page on a finished draw stays quiet).
 */
function useDrawSounds(kind: DrawPhase['kind'], on: boolean) {
  const previous = useRef(kind);
  const roll = useRef<(() => void) | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = kind;
    if (!on) {
      roll.current?.();
      roll.current = null;
      return;
    }
    if (kind === 'buildUp' && !roll.current) {
      roll.current = startDrumroll();
    }
    if (kind === 'done') {
      roll.current?.();
      roll.current = null;
      if (before !== 'done') playWin();
    }
  }, [kind, on]);
  useEffect(
    () => () => {
      roll.current?.();
    },
    [],
  );
}

export function WinnerCard({ code, record, big }: { code: string; record: OfficeDrawRecord; big: boolean }) {
  const t = useTranslations('officeSession.draw');
  const tAvatar = useTranslations('avatar');
  const winners = record.winners
    .map((id) => record.candidates.find((c) => c.id === id))
    .filter((c) => c !== undefined);
  const size = (big ? 1.6 : 1) * (winners.length === 1 ? 140 : winners.length <= 3 ? 104 : 72);

  return (
    <div className="draw-result" data-testid="draw-result">
      <div className="result-glow" aria-hidden="true" />
      <div className="result-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <p className="draw-result-title">
        {t('picked', { n: winners.length })} · {t('round', { n: record.round })}
      </p>
      <ul className="draw-winners">
        {winners.map((w) => (
          <li key={w.id} className="draw-winner" data-testid="draw-winner">
            <Avatar avatar={w.avatar} size={size} label={animalLabel(tAvatar, w)} />
            <span className="draw-winner-name">{w.name}</span>
          </li>
        ))}
      </ul>
      <Link href={`/office/s/${code}/verify/${record.drawId}`} className="draw-verify-link" target="_blank">
        🔍 {t('verify')}
      </Link>
    </div>
  );
}
