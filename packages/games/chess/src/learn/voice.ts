'use client';

import { useEffect, useState } from 'react';
import type { VoiceState } from './ReadAloud';
import { stopSpeaking } from './speech';

const KEY = 'learn.chess.voice.v1';
type Stored = { auto?: unknown; results?: unknown };

/**
 * The voice settings of a lesson: the language, "read each question" and "read the result". Both are on until
 * switched off, and the choice is remembered: children who cannot read yet need to hear the question and whether
 * they were right.
 */
export function useVoice(lang: string): VoiceState {
  const [auto, setAuto] = useState(true);
  const [results, setResults] = useState(true);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Stored;
      if (typeof stored.auto === 'boolean') setAuto(stored.auto);
      if (typeof stored.results === 'boolean') setResults(stored.results);
    } catch {
      /* no storage, or broken data: keep the defaults */
    }
  }, []);

  const save = (next: { auto: boolean; results: boolean }) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* not remembered */
    }
  };
  const onAuto = (value: boolean) => {
    setAuto(value);
    if (!value) stopSpeaking();
    save({ auto: value, results });
  };
  const onResults = (value: boolean) => {
    setResults(value);
    if (!value) stopSpeaking();
    save({ auto, results: value });
  };

  return { lang, auto, onAuto, results, onResults };
}
