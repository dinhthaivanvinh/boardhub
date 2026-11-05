'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Avatar, randomAvatar } from '@bg/avatars';
import type { Rng } from '@bg/engine';
import { errorKey } from '@/game-runtime/error-key';
import { useOfficeSession } from '@/office/use-office-session';
import { animalLabel, Connecting, joinUrl, OfficeError, QrCode } from './shared';

const uiRng: Rng = {
  next: () => Math.random(),
  int: (a, b) => a + Math.floor(Math.random() * (b - a)),
  shuffle: (items) => [...items].sort(() => Math.random() - 0.5),
};

/** The host's console: who is in, lock, kick, rename, add someone absent, open the stage. */
export function HostScreen({ code }: { code: string }) {
  const t = useTranslations('officeSession');
  const tAll = useTranslations();
  const tAvatar = useTranslations('avatar');
  const api = useOfficeSession(code, 'host', true);
  const [error, setError] = useState<string | null>(null);
  const [absentName, setAbsentName] = useState('');
  const [copied, setCopied] = useState(false);
  const { session } = api;
  if (api.joinError && !session) return <OfficeError code={api.joinError} />;
  if (!session) return <Connecting />;
  if (!session.me.isHost) return <OfficeError code="office.not_host" />;

  const run = async (p: Promise<string | null>) => setError(await p);
  const url = joinUrl(code);
  const closed = session.status === 'closed';
  const locked = session.status === 'locked';

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex flex-col gap-4">
        <div>
          <p className="chip chip-accent">{t(`activity.${session.activityId}`)}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            {session.title || t('untitled')}
          </h1>
          <p className="mt-1 text-[var(--muted)]" aria-live="polite" data-testid="host-count">
            {t('count', { n: session.participants.length })}
            {locked ? ` · 🔒 ${t('locked')}` : ''}
            {closed ? ` · ${t('closed')}` : ''}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {tAll(errorKey(error))}
          </p>
        )}

        <ul className="flex flex-col gap-2" aria-label={t('people')}>
          {session.participants.map((p) => (
            <ParticipantRow
              key={p.id}
              label={animalLabel(tAvatar, p)}
              participant={p}
              disabled={closed}
              onRename={(name) => run(api.host({ op: 'rename', id: p.id, name }))}
              onKick={() => run(api.host({ op: 'kick', id: p.id }))}
            />
          ))}
          {session.participants.length === 0 && (
            <li className="card text-[var(--muted)]">{t('waitingFirst')}</li>
          )}
        </ul>

        {!closed && (
          <form
            className="card flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = absentName.trim();
              if (!name) return;
              setAbsentName('');
              void run(api.host({ op: 'add-absent', name, avatar: randomAvatar(uiRng) }));
            }}
          >
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
              {t('addAbsent')}
              <input
                value={absentName}
                onChange={(e) => setAbsentName(e.target.value)}
                maxLength={24}
                placeholder={t('addAbsentPlaceholder')}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
              />
            </label>
            <button type="submit" className="btn" disabled={!absentName.trim()}>
              + {t('add')}
            </button>
          </form>
        )}
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card flex flex-col items-center gap-3 text-center">
          <QrCode value={url} size={180} />
          <p className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="host-code">
            {code}
          </p>
          <button
            type="button"
            className="btn w-full"
            onClick={() => {
              void navigator.clipboard?.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? `✓ ${t('copied')}` : t('copyLink')}
          </button>
          <a
            href={`/office/s/${code}/screen`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary w-full"
          >
            📺 {t('openStage')}
          </a>
        </div>
        {!closed && (
          <div className="card flex flex-col gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => void run(api.host({ op: locked ? 'unlock' : 'lock' }))}
            >
              {locked ? `🔓 ${t('unlock')}` : `🔒 ${t('lock')}`}
            </button>
            <p className="text-xs text-[var(--muted)]">{t('lockHint')}</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (window.confirm(t('closeConfirm'))) void run(api.host({ op: 'close' }));
              }}
            >
              {t('close')}
            </button>
          </div>
        )}
        <p className="card text-sm text-[var(--muted)]">{t('drawSoon')}</p>
      </aside>
    </div>
  );
}

function ParticipantRow({
  participant: p,
  label,
  disabled,
  onRename,
  onKick,
}: {
  participant: {
    id: string;
    name: string;
    online: boolean;
    absent: boolean;
    avatar: Parameters<typeof Avatar>[0]['avatar'];
  };
  label: string;
  disabled: boolean;
  onRename(name: string): void;
  onKick(): void;
}) {
  const t = useTranslations('officeSession');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  return (
    <li className="card flex items-center gap-3 py-2.5" data-testid="host-participant" data-online={p.online}>
      <Avatar avatar={p.avatar} size={44} label={label} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setEditing(false);
              if (name.trim() && name.trim() !== p.name) onRename(name.trim());
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              aria-label={t('rename')}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
            />
            <button type="submit" className="btn py-1">
              {t('save')}
            </button>
          </form>
        ) : (
          <p className="truncate font-medium">{p.name}</p>
        )}
        <p className="text-xs text-[var(--muted)]">
          {p.absent ? `📵 ${t('absent')}` : p.online ? `● ${t('online')}` : `○ ${t('offline')}`}
        </p>
      </div>
      {!disabled && !editing && (
        <div className="flex gap-1">
          <button type="button" className="btn px-2.5 py-1 text-xs" onClick={() => setEditing(true)}>
            {t('rename')}
          </button>
          <button
            type="button"
            className="btn px-2.5 py-1 text-xs"
            aria-label={t('kickWho', { name: p.name })}
            onClick={onKick}
          >
            {t('kick')}
          </button>
        </div>
      )}
    </li>
  );
}
