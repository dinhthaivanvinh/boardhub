'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { LiXiSettings } from '@bg/office-li-xi';
import type { OfficeSnapshot } from '@bg/protocol';
import { useSpaceToSpin } from '@/features/office/session/DrawPanel';
import { useOfficeSound } from '@/features/office/draw-player/sounds';
import { sessionPath } from '@/office/areas';
import { LiXiPreview, LiXiSettingsEditor, settingsError } from '../LiXiSettingsEditor';
import { formatVnd } from '../money';
import { useLiXiControls } from './controls';
import { LiXiStage } from './LiXiStage';

/**
 * The host's Lì xì controls: before the giving, the notes (still editable) and a preview for the people
 * in the room; then the live room in small, the big "Call the next person" button (or Space), and a
 * link to check each turn.
 */
export function LiXiHostPanel({
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
  const t = useTranslations('liXiHost');
  const locale = useLocale();
  const sound = useOfficeSound((x) => x.on);
  const { view, action, can, playing, closed } = useLiXiControls(session, serverOffset);
  const [draft, setDraft] = useState<LiXiSettings | null>(null);
  const act = () => action && onAction({ kind: action });
  useSpaceToSpin(can, act);
  if (!view) return null;
  const settings = draft ?? view.settings;
  // The turn still playing stays secret here too, until its envelope is open.
  const gifts = playing ? view.gifts.filter((g) => g.drawId !== session.draw?.drawId) : view.gifts;

  return (
    <section className="card flex flex-col gap-4" aria-labelledby="li-xi-heading" data-testid="li-xi-host">
      <h2 id="li-xi-heading" className="text-lg font-bold">
        🧧 {view.started ? t('giving') : t('settingsTitle')}
      </h2>

      {!view.started ? (
        <>
          <LiXiSettingsEditor
            value={settings}
            disabled={closed}
            onChange={(next) => {
              setDraft(next);
              if (!settingsError(next)) onAction({ kind: 'configure', patch: next });
            }}
          />
          <div className="lixi-preview-box">
            <p className="font-semibold">{t('previewNow', { n: view.waiting })}</p>
            <LiXiPreview settings={settings} people={view.waiting} />
          </div>
          {view.waiting === 0 && <p className="text-sm text-[var(--muted)]">{t('needPeople')}</p>}
        </>
      ) : (
        <LiXiStage session={session} serverOffset={serverOffset} big={false} sound={sound} />
      )}

      {action || playing ? (
        <div className="flex flex-col items-stretch gap-1">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!can || (!view.started && settingsError(settings) !== null)}
            onClick={act}
            data-testid="li-xi-act"
          >
            {playing ? t('opening') : action === 'start' ? `🧧 ${t('start')}` : `🔔 ${t('next')}`}
          </button>
          <p className="text-center text-xs text-[var(--muted)]">{t('spaceHint')}</p>
        </div>
      ) : (
        <p className="text-center font-semibold" data-testid="li-xi-all-done">
          🎉 {t('allDone', { total: formatVnd(locale, view.total) })}
        </p>
      )}

      {gifts.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t('verifyTitle')}</summary>
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {gifts.map((g, i) => (
              <li key={g.drawId} className="flex items-center gap-2">
                <span className="text-[var(--muted)]">{i + 1}.</span>
                <span className="flex-1 truncate">
                  {g.name} · {g.value > 0 ? formatVnd(locale, g.value) : '🌸'}
                </span>
                <Link
                  href={sessionPath('li-xi', code, `/verify/${g.drawId}`)}
                  target="_blank"
                  className="text-[var(--accent)] underline"
                >
                  🔍
                </Link>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
