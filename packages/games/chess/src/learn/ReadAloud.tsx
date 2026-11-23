'use client';

import { useEffect, useState } from 'react';
import type { Translator } from '@bg/ui';
import { canSpeak, speak, stopSpeaking } from './speech';

export type VoiceState = { lang: string; auto: boolean; onAuto(auto: boolean): void };

/** "Read aloud" button and the "read automatically" switch. Renders nothing when the browser has no voice. */
export function ReadAloud({ text, voice, t }: { text: string; voice: VoiceState; t: Translator }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(canSpeak());
    return stopSpeaking;
  }, []);
  useEffect(() => {
    if (voice.auto && text) speak(text, voice.lang);
    // Speaks when the text changes (a new step), not when the switch is turned off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.auto, text]);
  if (!available) return null;
  return (
    <div className="ch-learn-actions">
      <button type="button" className="btn" onClick={() => speak(text, voice.lang)}>
        🔊 {t('games.chess.learn.readAloud')}
      </button>
      <label className="ch-learn-toggle">
        <input
          type="checkbox"
          checked={voice.auto}
          onChange={(e) => {
            voice.onAuto(e.target.checked);
            stopSpeaking();
          }}
        />{' '}
        {t('games.chess.learn.autoRead')}
      </label>
    </div>
  );
}
