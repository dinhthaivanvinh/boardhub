'use client';

import { useEffect, useState } from 'react';
import type { Translator } from '@bg/ui';
import { canSpeak, speak, stopSpeaking, voiceStatus } from './speech';

export type VoiceState = { lang: string; auto: boolean; onAuto(auto: boolean): void };

/** "Read aloud" button and the "read automatically" switch. Renders nothing when the browser has no voice. */
/** Whether the device has a voice for the language; updates when the browser finishes listing its voices. */
function useVoiceStatus(lang: string): 'yes' | 'no' | 'unknown' | 'none' {
  const [status, setStatus] = useState<'yes' | 'no' | 'unknown' | 'none'>('none');
  useEffect(() => {
    if (!canSpeak()) return setStatus('none');
    const update = () => setStatus(voiceStatus(lang));
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      stopSpeaking();
    };
  }, [lang]);
  return status;
}

/** "Read aloud" button and the "read automatically" switch. Says so when the device has no voice for the language. */
export function ReadAloud({ text, voice, t }: { text: string; voice: VoiceState; t: Translator }) {
  const status = useVoiceStatus(voice.lang);
  const available = status === 'yes' || status === 'unknown';
  useEffect(() => {
    if (available && voice.auto && text) speak(text, voice.lang);
    // Speaks when the text changes (a new step), not when the switch is turned off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, voice.auto, text]);
  if (status === 'none') return null;
  if (!available) {
    return (
      <p className="ch-learn-status" role="status">
        {t('games.chess.learn.noVoice')}
      </p>
    );
  }
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
