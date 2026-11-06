'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { settingsSchema, type LiXiSettings } from '@bg/office-li-xi';
import type { OfficeSnapshot } from '@bg/protocol';
import { errorKey } from '@/game-runtime/error-key';
import { sessionPath } from '@/office/areas';
import { getOfficeSocket, officeRequest } from '@/office/office-socket';
import { LiXiPreview, LiXiSettingsEditor, settingsError } from './LiXiSettingsEditor';

/** /party/li-xi/new: name the room, set the notes, see what it costs, get a code. */
export function LiXiCreateForm() {
  const t = useTranslations('liXiNew');
  const tAll = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [settings, setSettings] = useState<LiXiSettings>(() => settingsSchema.parse({}));
  const [people, setPeople] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = settingsError(settings) !== null;

  return (
    <form
      className="card mx-auto flex max-w-2xl flex-col gap-6"
      data-testid="li-xi-create"
      onSubmit={async (e) => {
        e.preventDefault();
        if (invalid) return;
        setBusy(true);
        setError(null);
        const s = await getOfficeSocket();
        const res = await officeRequest<{ session: OfficeSnapshot }>(s, 'office:create', {
          activityId: 'li-xi',
          title: title.trim() || t('titlePlaceholder'),
          settings,
        });
        setBusy(false);
        if (!res.ok) return setError(res.code);
        router.push(sessionPath('li-xi', res.data.session.code, '/host'));
      }}
    >
      <label className="flex flex-col gap-1 font-medium">
        {t('titleLabel')}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder={t('titlePlaceholder')}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-lg"
        />
      </label>

      <LiXiSettingsEditor value={settings} onChange={setSettings} />

      <section className="lixi-preview-box" aria-labelledby="li-xi-preview-title">
        <h2 id="li-xi-preview-title" className="font-semibold">
          🧧 {t('previewTitle')}
        </h2>
        <label className="flex items-center gap-3 text-sm">
          {t('previewPeople', { n: people })}
          <input
            type="range"
            min={1}
            max={60}
            value={people}
            onChange={(e) => setPeople(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        <LiXiPreview settings={settings} people={people} />
      </section>

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {tAll(errorKey(error))}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy || invalid}>
        {t('create')}
      </button>
    </form>
  );
}
