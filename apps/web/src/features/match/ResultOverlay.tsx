'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

export type ResultTone = 'win' | 'loss' | 'draw' | 'neutral';

/** Shortest time the last move gets on screen before the result covers the board. */
const SETTLE_MS = 800;

/**
 * The end of a game, announced in the middle of the board with a glow.
 * It waits until the last move has finished playing out: boards mark running animations with
 * `data-animating="true"` (e.g. Ô ăn quan's sowing), and slides are over within SETTLE_MS.
 * "View board" hides it until the game is no longer over (a new game, or an undo).
 */
export function ResultOverlay({
  show,
  tone,
  title,
  detail,
  icon,
  boardRef,
}: {
  show: boolean;
  tone: ResultTone;
  title: string;
  detail: string;
  icon?: ReactNode;
  boardRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('match.overlay');
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setReady(false);
    if (!show) {
      setDismissed(false);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const busy = boardRef.current?.querySelector('[data-animating="true"]');
      if (Date.now() - started >= SETTLE_MS && !busy) {
        clearInterval(timer);
        setReady(true);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [show, boardRef]);

  const visible = show && ready && !dismissed;

  useEffect(() => {
    if (!visible) return;
    dismissButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDismissed(true);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className={`result-overlay result-${tone}`} data-testid="result-overlay" data-tone={tone}>
      <div className="result-backdrop" onClick={() => setDismissed(true)} aria-hidden="true" />
      <div className="result-glow" aria-hidden="true" />
      <div className="result-rays" aria-hidden="true" />
      <div className="result-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="result-card" role="dialog" aria-modal="false" aria-labelledby="result-title">
        {icon && <div className="result-icon">{icon}</div>}
        <p id="result-title" className="result-title">
          {title}
        </p>
        <p className="result-detail">{detail}</p>
        <button ref={dismissButton} type="button" className="btn mt-3" onClick={() => setDismissed(true)}>
          {t('viewBoard')}
        </button>
      </div>
    </div>
  );
}
