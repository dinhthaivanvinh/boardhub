'use client';

import { useEffect } from 'react';
import type { VoiceState } from './ReadAloud';
import { speak } from './speech';

/**
 * The line that tells a child how they did. It is also read aloud when it changes, so a child who cannot read
 * yet hears "right" or "try again". `nonce` makes the same text count as new (a second wrong answer says it
 * again); `speakIt={false}` keeps a line silent (a counter, a hint that is read by its own button).
 */
export function Status({
  text,
  voice,
  nonce = 0,
  speakIt = true,
  className = 'ch-learn-status',
}: {
  text: string;
  voice: VoiceState;
  nonce?: number;
  speakIt?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (speakIt && voice.results && text) speak(text, voice.lang);
    // Only when the text or the nonce changes, not when a setting does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, nonce]);
  return (
    <p key={`${nonce}:${text}`} className={className} role="status" aria-live="polite">
      {text}
    </p>
  );
}
