'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { installUnlock } from './engine';
import { playSound } from './play';
import { useSoundSettings } from './settings';

/** Effects and music, each with an on/off switch and a volume (shown on every match screen). */
export function SoundControls() {
  const t = useTranslations('sound');
  const s = useSoundSettings();
  useEffect(installUnlock, []);

  const row = (key: 'effects' | 'music', volumeKey: 'effectsVolume' | 'musicVolume', icon: string) => (
    <div className="flex items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={s[key]}
          onChange={(e) => s.update({ [key]: e.target.checked })}
          data-testid={`sound-${key}`}
        />
        <span aria-hidden="true">{icon}</span>
        {t(key)}
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={s[volumeKey]}
        disabled={!s[key]}
        onChange={(e) => s.update({ [volumeKey]: Number(e.target.value) })}
        // A short sample so the level can be heard while choosing it.
        onPointerUp={() => key === 'effects' && playSound('place')}
        aria-label={t('volume', { what: t(key) })}
        className="w-24 accent-[var(--accent)] disabled:opacity-40"
      />
    </div>
  );

  return (
    <fieldset className="card flex flex-col gap-2 py-3 text-sm">
      <legend className="px-1 font-medium">{t('title')}</legend>
      {row('effects', 'effectsVolume', '🔊')}
      {row('music', 'musicVolume', '🎵')}
    </fieldset>
  );
}
