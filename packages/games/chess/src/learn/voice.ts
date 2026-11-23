'use client';

import { useEffect, useState } from 'react';
import type { VoiceState } from './ReadAloud';
import { stopSpeaking } from './speech';

const KEY = 'learn.chess.voice.v1';

/**
 * The voice settings of a lesson: the language, "read each question" (off until switched on) and "read the
 * result" (on until switched off, and remembered): children who cannot read yet need to hear whether they were right.
 */
export function useVoice(lang: string): VoiceState {
  const [auto, setAuto] = useState(false);
  const [results, setResults] = useState(true);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as { results?: unknown };
      if (typeof stored.results === 'boolean') setResults(stored.results);
    } catch {
      /* no storage, or broken data: keep the default */
    }
  }, []);

  const onResults = (value: boolean) => {
    setResults(value);
    if (!value) stopSpeaking();
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ results: value }));
    } catch {
      /* not remembered */
    }
  };

  return { lang, auto, onAuto: setAuto, results, onResults };
}
