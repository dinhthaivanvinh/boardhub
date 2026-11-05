'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { MODES, type LuckyAnimalSettings, type LuckyAnimalView } from '@bg/office-lucky-animal';
import type { OfficeSnapshot } from '@bg/protocol';
import { DrawPlayer } from '../draw-player/DrawPlayer';
import { useOfficeSound } from '../draw-player/sounds';
import { isRevealed } from '../draw-player/timeline';

/** Who the next draw picks from — the same rule as the server's candidatesOf, from the live list. */
function candidateCount(session: OfficeSnapshot, view: LuckyAnimalView): number {
  const s = view.settings;
  return session.participants.filter(
    (p) =>
      (s.hostParticipates || p.id !== session.hostId) && !(s.excludePrevious && view.excluded.includes(p.id)),
  ).length;
}

const MODE_ICONS: Record<(typeof MODES)[number], string> = {
  race: '🏁',
  wheel: '🎡',
  spotlight: '🔦',
  claw: '🧸',
};

/** Can the host spin now? Shared by the panel and the presentation mode. */
export function drawReadiness(session: OfficeSnapshot) {
  const view = session.activity as LuckyAnimalView;
  const closed = session.status === 'closed';
  const running = session.draw !== null && !isRevealed(session.draw);
  const pool = candidateCount(session, view);
  return { view, closed, running, pool, canDraw: !closed && !running && pool >= view.settings.n };
}

/** Space spins, unless you are typing or on a button (docs/office/07 §3). */
export function useSpaceToSpin(canDraw: boolean, spin: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat || !canDraw) return;
      const el = e.target as HTMLElement | null;
      if (el && el.closest('input, textarea, button, select, a, [contenteditable="true"]')) return;
      e.preventDefault();
      spin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canDraw, spin]);
}

/** The host's draw controls (Thú may mắn): mode, how many, exclusions, the big "Spin!" button, history. */
export function DrawPanel({
  code,
  session,
  serverOffset,
  onAction,
}: {
  code: string;
  session: OfficeSnapshot;
  serverOffset: number;
  onAction(action: unknown): void;
}) {
  const t = useTranslations('officeSession.draw');
  const { view, closed, running, pool, canDraw } = drawReadiness(session);
  const s = view.settings;
  const sound = useOfficeSound((x) => x.on);
  const configure = (patch: Partial<LuckyAnimalSettings>) => onAction({ kind: 'configure', patch });
  const spin = () => onAction({ kind: 'draw' });
  // The current draw is in the player above (its result shows when the animation lands).
  const past = session.history.filter((d) => d.drawId !== session.draw?.drawId);

  useSpaceToSpin(canDraw, spin);

  return (
    <section className="card flex flex-col gap-4" aria-labelledby="draw-heading">
      <h2 id="draw-heading" className="text-lg font-bold">
        🎯 {t('heading')}
      </h2>

      {!closed && (
        <fieldset className="flex flex-col gap-3" disabled={running}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('mode')}>
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={s.mode === mode}
                className={s.mode === mode ? 'btn btn-primary' : 'btn'}
                onClick={() => s.mode !== mode && configure({ mode })}
              >
                {MODE_ICONS[mode]} {t(`modes.${mode}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" id="draw-n-label">
              {t('howMany')}
            </span>
            <button
              type="button"
              className="btn px-3"
              aria-label={t('fewer')}
              disabled={s.n <= 1}
              onClick={() => configure({ n: s.n - 1 })}
            >
              −
            </button>
            <output
              aria-labelledby="draw-n-label"
              className="w-8 text-center text-lg font-bold"
              data-testid="draw-n"
            >
              {s.n}
            </output>
            <button
              type="button"
              className="btn px-3"
              aria-label={t('more')}
              disabled={s.n >= 20}
              onClick={() => configure({ n: s.n + 1 })}
            >
              +
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.excludePrevious}
              onChange={(e) => configure({ excludePrevious: e.target.checked })}
            />
            {t('excludePrevious')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.hostParticipates}
              onChange={(e) => configure({ hostParticipates: e.target.checked })}
            />
            {t('hostParticipates')}
          </label>
        </fieldset>
      )}

      {!closed && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-lg draw-spin"
            disabled={!canDraw}
            onClick={spin}
            data-testid="draw-spin"
          >
            {running ? t('drawing') : `${t('spin')} (Space)`}
          </button>
          <p className="text-sm text-[var(--muted)]" data-testid="draw-pool">
            {t('pool', { n: pool })}
            {pool < s.n && ` · ${t('notEnough', { n: s.n })}`}
          </p>
          {s.excludePrevious && view.excluded.length > 0 && (
            <button
              type="button"
              className="btn self-start text-sm"
              disabled={running}
              onClick={() => onAction({ kind: 'reset-exclusions' })}
            >
              ↺ {t('resetExclusions', { n: view.excluded.length })}
            </button>
          )}
        </>
      )}

      {session.draw && (
        <DrawPlayer
          key={session.draw.drawId}
          code={code}
          draw={session.draw}
          serverOffset={serverOffset}
          sound={sound}
        />
      )}

      {past.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('history')}</h3>
          <ol className="flex flex-col gap-1 text-sm" data-testid="draw-history">
            {past.map((d) => (
              <li key={d.drawId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[var(--muted)]">{t('round', { n: d.round })}:</span>
                <span className="font-medium">
                  {d.winners.map((id) => d.candidates.find((c) => c.id === id)?.name ?? '?').join(', ')}
                </span>
                <Link
                  href={`/office/s/${code}/verify/${d.drawId}`}
                  target="_blank"
                  className="text-xs text-[var(--accent)] underline"
                >
                  {t('verify')}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
