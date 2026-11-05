'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState } from 'react';
import { REPORT_REASONS, type ChatMessage, type ReportReason, type RoomSnapshot } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { sendReport } from '@/online/admin-api';

/**
 * "Báo cáo" in a room (FR-ADM-02): pick a player (seated or who chatted), a reason and a note.
 * The server keeps that player's chat lines from this room as evidence for the admins.
 */
export function ReportButton({
  room,
  chat,
  myUserId,
  labels,
}: {
  room: RoomSnapshot;
  chat: ChatMessage[];
  myUserId: string | null;
  labels?: Map<string, string>;
}) {
  const t = useTranslations('report');
  const tAll = useTranslations();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Everyone else who is or was here: seated players first, then people from the chat.
  const people = useMemo(() => {
    const out = new Map<string, string>();
    for (const s of room.seats)
      if (s?.kind === 'user' && s.userId !== myUserId) out.set(s.userId, labels?.get(s.userId) ?? s.name);
    for (const m of chat)
      if (m.from.userId !== myUserId && !out.has(m.from.userId))
        out.set(m.from.userId, labels?.get(m.from.userId) ?? m.from.name);
    return [...out];
  }, [room.seats, chat, myUserId, labels]);

  const [target, setTarget] = useState('');
  const [reason, setReason] = useState<ReportReason>('abuse');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setTarget(people[0]?.[0] ?? '');
    setReason('abuse');
    setNote('');
    setState('idle');
    setError(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  if (people.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="btn px-3 py-1.5 text-sm"
        aria-haspopup="dialog"
        onClick={openDialog}
        data-testid="report-open"
      >
        <span aria-hidden="true">🚩</span> {t('open')}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--fg)] backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <form
          className="flex flex-col gap-4 px-5 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!target) return;
            setState('sending');
            const res = await sendReport({ targetUserId: target, reason, note, roomCode: room.code });
            setState(res.ok ? 'sent' : 'idle');
            setError(res.ok ? null : res.code);
          }}
        >
          <header className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-lg font-semibold">
              {t('title')}
            </h2>
            <button type="button" className="btn px-2.5 py-1" onClick={close} aria-label={t('close')}>
              ✕
            </button>
          </header>

          {state === 'sent' ? (
            <>
              <p role="status" data-testid="report-sent">
                {t('sent')}
              </p>
              <button type="button" className="btn btn-primary" onClick={close}>
                {t('close')}
              </button>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm">
                {t('who')}
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  data-testid="report-target"
                >
                  {people.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="flex flex-col gap-1.5 text-sm">
                <legend className="mb-1">{t('why')}</legend>
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                    />
                    {t(`reasons.${r}`)}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1 text-sm">
                {t('note')}
                <textarea
                  className="min-h-20 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('notePlaceholder')}
                />
              </label>
              <p className="text-xs text-[var(--muted)]">{t('privacy')}</p>
              {error && (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {tAll(errorKey(error))}
                </p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={state === 'sending' || !target}
                data-testid="report-send"
              >
                {state === 'sending' ? t('sending') : t('send')}
              </button>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
