'use client';

import { useTranslations } from 'next-intl';
import { unlockAudio, useOfficeSound } from './sounds';

export function SoundToggle({ className = '' }: { className?: string }) {
  const t = useTranslations('officeSession.sound');
  const { on, toggle } = useOfficeSound();
  return (
    <button
      type="button"
      className={`sound-toggle ${className}`}
      aria-pressed={on}
      aria-label={on ? t('off') : t('on')}
      title={on ? t('off') : t('on')}
      onClick={() => {
        if (!on) unlockAudio();
        toggle();
      }}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
    </button>
  );
}
