'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { OfficeSnapshot } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import type { LiveReaction } from '@/office/use-office-session';
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
  const { canDraw, running } = drawReadiness(session);
  const spin = () => {
    void onAction({ kind: 'draw' }).then(setError);
  };
  useSpaceToSpin(canDraw, spin);

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
              disabled={!canDraw}
              onClick={spin}
              data-testid="present-spin"
            >
              {running ? t('spinning') : t('spin')}
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
