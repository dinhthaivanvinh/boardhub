'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, type ReactNode } from 'react';
import { SimpleMarkdown } from '@/components/SimpleMarkdown';
import type { GameId } from '@/games/catalog';
import { CLIENT_GAMES } from '@/games/client-registry';
import { describeConfig } from './config-labels';

/**
 * "Luật chơi" button + dialog, usable during a game without leaving it.
 * Shows the options of this particular game first (they differ between games), then the full rules.
 * Uses the native <dialog>: focus stays inside, Esc closes, the page behind keeps running.
 */
export function RulesButton({
  gameId,
  config,
  extra,
}: {
  gameId: GameId;
  config: Record<string, unknown>;
  /** Extra rows for the "this game" list, e.g. the time control of an online room. */
  extra?: { label: string; value: string }[];
}) {
  const t = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const rows = [...describeConfig(t, gameId, CLIENT_GAMES[gameId].configFields, config), ...(extra ?? [])];
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        className="btn px-3 py-1.5 text-sm"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <span aria-hidden="true">📖</span> {t('rules.open')}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--fg)] backdrop:bg-black/50"
        // A click on the backdrop lands on the <dialog> itself (the content fills it), so it closes.
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {t('rules.title', { game: t(`games.${gameId}.name`) })}
            </h2>
            <button type="button" className="btn px-2.5 py-1" onClick={close} aria-label={t('rules.close')}>
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">
            {rows.length > 0 && (
              <section className="mb-4 rounded-lg bg-[var(--bg)] px-4 py-3" aria-label={t('rules.thisGame')}>
                <h3 className="mb-2 text-sm font-medium">{t('rules.thisGame')}</h3>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  {rows.map((row) => (
                    <Row key={row.label} label={row.label}>
                      {row.value}
                    </Row>
                  ))}
                </dl>
              </section>
            )}
            <SimpleMarkdown text={t.raw(`games.${gameId}.rules`) as string} />
          </div>
        </div>
      </dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </>
  );
}
