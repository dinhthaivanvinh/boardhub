'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { OfficeSnapshot } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import type { LiveReaction } from '@/office/use-office-session';
import { useLiXiControls } from '@/features/party/li-xi/controls';
import { drawReadiness, useSpaceToSpin } from './DrawPanel';
import { StageView } from './StageScreen';

/**
 * The host's laptop on the projector (docs/office/07 §1): the stage view, full screen, with only
 * "Spin" (also Space) and "Exit" (also Esc). Settings stay as they were in the console.
 */
export function PresentationMode({
  code,
  session,
  serverOffset,
  reactions,
  onAction,
  onExit,
}: {
  code: string;
  session: OfficeSnapshot;
  serverOffset: number;
  reactions: LiveReaction[];
  onAction(action: unknown): Promise<string | null>;
  onExit(): void;
}) {
  const t = useTranslations('officeSession.present');
  const tAll = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const primary = usePrimaryAction(session, serverOffset);
  const spin = () => {
    if (primary.action) void onAction({ kind: primary.action }).then(setError);
  };
  useSpaceToSpin(primary.can, spin);

  // Full screen while presenting (if the browser allows it); Esc leaves.
  useEffect(() => {
    const el = root.current;
    if (el?.requestFullscreen && !document.fullscreenElement) void el.requestFullscreen().catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExit();
    // Leaving full screen with the browser's own Esc also ends the presentation.
    const onFullscreen = () => !document.fullscreenElement && onExit();
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onExit]);

  return (
    <div ref={root} className="office-present" data-testid="presentation">
      <StageView
        code={code}
        session={session}
        serverOffset={serverOffset}
        reactions={reactions}
        corner={
          <>
            {error && (
              <span role="alert" className="office-present-error">
                {tAll(errorKey(error))}
              </span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!primary.can}
              onClick={spin}
              data-testid="present-spin"
            >
              {primary.label}
            </button>
            <button type="button" className="btn" onClick={onExit}>
              {t('exit')}
            </button>
          </>
        }
      />
    </div>
  );
}

/** The one button of the presentation: spin (Thú may mắn), or start / call the next person (Lì xì). */
function usePrimaryAction(session: OfficeSnapshot, serverOffset: number) {
  const t = useTranslations('officeSession.present');
  const tLiXi = useTranslations('liXiHost');
  const liXi = useLiXiControls(session, serverOffset);
  if (session.activityId === 'li-xi') {
    return {
      action: liXi.action,
      can: liXi.can,
      label: liXi.playing ? tLiXi('opening') : liXi.action === 'start' ? tLiXi('start') : tLiXi('next'),
    };
  }
  const { canDraw, running } = drawReadiness(session);
  return { action: 'draw' as const, can: canDraw, label: running ? t('spinning') : t('spin') };
}
