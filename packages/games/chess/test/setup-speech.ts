import { afterEach, beforeEach } from 'vitest';
import { resetVoicePacks } from '../src/learn/speech';
import { speechEntries } from '../src/learn/speech-texts';

/**
 * Every component test runs with a speech synthesis that has a Vietnamese voice and records what the lessons say.
 * After each test, every sentence said must be one of the sentences the voice files were made for
 * (`speechTexts`): a lesson that says something new would be read by the browser's own voice, not the recording.
 * A test that needs its own speech synthesis simply installs one over this.
 */
const allowed = new Set(speechEntries('vi').map((e) => e.spoken));
const recorded: string[] = [];

class Utterance {
  voice: unknown;
  lang = '';
  rate = 1;
  constructor(public text: string) {}
}

beforeEach(() => {
  if (typeof window === 'undefined') return;
  recorded.length = 0;
  resetVoicePacks();
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ lang: 'vi-VN', name: 'Vietnamese' }],
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      speaking: false,
      speak: (u: Utterance) => void recorded.push(u.text),
    },
  });
});

afterEach(() => {
  const unknown = recorded.filter((text) => !allowed.has(text));
  recorded.length = 0;
  if (unknown.length > 0) {
    throw new Error(
      `Said aloud but not in speechTexts (no recording for it):\n  ${[...new Set(unknown)].join('\n  ')}`,
    );
  }
});
