// @vitest-environment jsdom
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasVoicePack,
  loadVoicePack,
  resetVoicePacks,
  speak,
  speakParts,
  stopSpeaking,
  voiceStatus,
  waitUntilSilent,
} from '../src/learn/speech';
import { speechEntries } from '../src/learn/speech-texts';
import { voiceKey } from '../src/learn/voice-hash';

const SENTENCE = 'Đúng rồi!';
const KEY = voiceKey(SENTENCE);

/** An audio element that records what it was asked to play. */
function installAudio(options: { rejectPlay?: boolean } = {}) {
  const played: { url: string; el: FakeAudio }[] = [];
  class FakeAudio {
    paused = true;
    ended = false;
    private handlers: Record<string, () => void> = {};
    constructor(public url: string) {}
    addEventListener(name: string, fn: () => void) {
      this.handlers[name] = fn;
    }
    play() {
      if (options.rejectPlay) return Promise.reject(new Error('blocked'));
      this.paused = false;
      played.push({ url: this.url, el: this });
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    finish() {
      this.paused = true;
      this.ended = true;
      this.handlers.ended?.();
    }
  }
  Object.assign(globalThis, { Audio: FakeAudio });
  return played;
}

/** The recordings list the server would send (or a failure). */
function installFetch(files: string[] | 'missing') {
  Object.assign(globalThis, {
    fetch: vi.fn(async () =>
      files === 'missing'
        ? ({ ok: false, status: 404 } as Response)
        : ({ ok: true, status: 200, json: async () => ({ files }) } as Response),
    ),
  });
}

/** A browser voice that records what it was asked to say. */
function installBrowserVoice(voices: { lang: string; name: string }[]) {
  const said: string[] = [];
  class Utterance {
    voice: unknown;
    lang = '';
    rate = 1;
    constructor(public text: string) {}
  }
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      speaking: false,
      speak: (u: Utterance) => said.push(u.text),
    },
  });
  return said;
}

beforeEach(() => resetVoicePacks());
afterEach(() => {
  resetVoicePacks();
  Reflect.deleteProperty(globalThis, 'fetch');
  Reflect.deleteProperty(globalThis, 'Audio');
});

describe('the recorded voice', () => {
  it('plays the file of a sentence and does not touch the browser voice', async () => {
    const played = installAudio();
    const said = installBrowserVoice([{ lang: 'en-US', name: 'English' }]);
    installFetch([KEY]);
    expect(await loadVoicePack('vi')).toBe(true);

    expect(speak(SENTENCE, 'vi')).toBe(true);
    expect(played.map((p) => p.url)).toEqual([`/audio/vi-edge/${KEY}.mp3`]);
    expect(said).toEqual([]);
  });

  it('works on a browser with no speech synthesis at all', async () => {
    installAudio();
    installFetch([KEY]);
    Reflect.deleteProperty(window, 'speechSynthesis');
    await loadVoicePack('vi');
    expect(voiceStatus('vi')).toBe('yes');
    expect(speak(SENTENCE, 'vi')).toBe(true);
  });

  it('finds the file of a sentence with squares by the way the voice says them', async () => {
    const played = installAudio();
    installBrowserVoice([]);
    const sentence = 'Tìm ô d3.';
    installFetch([voiceKey('Tìm ô đê 3.')]);
    await loadVoicePack('vi');
    expect(speak(sentence, 'vi')).toBe(true);
    expect(played).toHaveLength(1);
  });

  it('a sentence with no file is read by the browser voice, if it has one for the language', async () => {
    const played = installAudio();
    const said = installBrowserVoice([{ lang: 'vi-VN', name: 'Vietnamese' }]);
    installFetch([KEY]);
    await loadVoicePack('vi');

    expect(speak('Một câu chưa có file', 'vi')).toBe(true);
    expect(played).toEqual([]);
    expect(said).toEqual(['Một câu chưa có file']);
  });

  it('with no file and no browser voice for the language, nothing is said (never the wrong language)', async () => {
    installAudio();
    const said = installBrowserVoice([{ lang: 'en-US', name: 'English' }]);
    installFetch([KEY]);
    await loadVoicePack('vi');
    expect(speak('Một câu chưa có file', 'vi')).toBe(false);
    expect(said).toEqual([]);
  });

  it('a file that cannot be played falls back to the browser voice', async () => {
    installAudio({ rejectPlay: true });
    const said = installBrowserVoice([{ lang: 'vi-VN', name: 'Vietnamese' }]);
    installFetch([KEY]);
    await loadVoicePack('vi');
    speak(SENTENCE, 'vi');
    await waitFor(() => said.length === 1);
    expect(said).toEqual([SENTENCE]);
  });

  it('no recordings for a language: the browser voice does it', async () => {
    installAudio();
    const said = installBrowserVoice([{ lang: 'en-US', name: 'English' }]);
    installFetch('missing');
    expect(await loadVoicePack('en')).toBe(false);
    expect(hasVoicePack('en')).toBe(false);
    expect(speak('Correct!', 'en')).toBe(true);
    expect(said).toEqual(['Correct!']);
  });

  it('plays the parts of a sentence one after the other, and stops when told', async () => {
    const played = installAudio();
    installBrowserVoice([]);
    const keys = ['Mã', 'ở bê 6.', 'từ bê 1'].map(voiceKey);
    installFetch(keys);
    await loadVoicePack('vi');

    expect(speakParts(['Mã', 'ở b6.', 'từ b1'], 'vi')).toBe(true);
    expect(played).toHaveLength(1);
    played[0]!.el.finish();
    expect(played.map((p) => p.url)).toEqual(keys.slice(0, 2).map((k) => `/audio/vi-edge/${k}.mp3`));
    stopSpeaking();
    played[1]!.el.finish();
    expect(played).toHaveLength(2);
  });

  it('the browser voice reads the whole sentence when a part has no file', async () => {
    const played = installAudio();
    const said = installBrowserVoice([{ lang: 'vi-VN', name: 'Vietnamese' }]);
    installFetch([voiceKey('Mã')]);
    await loadVoicePack('vi');

    expect(speakParts(['Mã', 'ở b6.'], 'vi')).toBe(true);
    expect(played).toEqual([]);
    expect(said).toEqual(['Mã ở bê 6.']);
  });

  // A screen asks its first question as it appears, while the list is still on its way. The browser here has
  // voices but none for Vietnamese, so falling back to it would leave the question unread.
  it('a sentence asked for while the list is loading is played once it has arrived', async () => {
    const played = installAudio();
    const said = installBrowserVoice([{ lang: 'en-US', name: 'English' }]);
    installFetch([KEY]);
    const loaded = loadVoicePack('vi');

    expect(speak(SENTENCE, 'vi')).toBe(true);
    let silent = false;
    void waitUntilSilent().then(() => (silent = true));
    expect(silent).toBe(false); // it is still to be said
    await loaded;
    await waitFor(() => played.length === 1);
    expect(played.map((p) => p.url)).toEqual([`/audio/vi-edge/${KEY}.mp3`]);
    expect(said).toEqual([]);
  });

  it('only the last sentence asked for while loading is said, and none after being told to stop', async () => {
    const played = installAudio();
    installBrowserVoice([]);
    installFetch([KEY, voiceKey('Mã')]);
    let loaded = loadVoicePack('vi');
    speak(SENTENCE, 'vi');
    speakParts(['Mã'], 'vi');
    await loaded;
    await new Promise((r) => setTimeout(r, 0));
    expect(played.map((p) => p.url)).toEqual([`/audio/vi-edge/${voiceKey('Mã')}.mp3`]);

    resetVoicePacks();
    played.length = 0;
    loaded = loadVoicePack('vi');
    speak(SENTENCE, 'vi');
    stopSpeaking();
    await loaded;
    await new Promise((r) => setTimeout(r, 0));
    expect(played).toEqual([]);
  });

  // A kept copy of the list would not name the sentences added by a new version of the site.
  it('asks the server whether the list has changed before using a kept copy', async () => {
    installAudio();
    installFetch([KEY]);
    await loadVoicePack('vi');
    expect(globalThis.fetch).toHaveBeenCalledWith('/audio/vi-edge/index.json', { cache: 'no-cache' });
  });

  it('looks for the recordings once, not at every sentence', async () => {
    installAudio();
    installFetch([KEY]);
    await Promise.all([loadVoicePack('vi'), loadVoicePack('vi')]);
    await loadVoicePack('vi');
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('waitUntilSilent waits for the recording to finish', async () => {
    const played = installAudio();
    installBrowserVoice([]);
    installFetch([KEY]);
    await loadVoicePack('vi');
    speak(SENTENCE, 'vi');

    let silent = false;
    void waitUntilSilent().then(() => (silent = true));
    await new Promise((r) => setTimeout(r, 450));
    expect(silent).toBe(false); // still playing
    played[0]!.el.finish();
    await waitFor(() => silent, 1500);
    expect(silent).toBe(true);
  });
});

async function waitFor(condition: () => boolean, ms = 1000) {
  const start = Date.now();
  while (!condition() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 20));
}

describe('the recordings shipped with the app', () => {
  const dir = join(__dirname, '../../../../apps/web/public/audio/vi-edge');
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as {
    files: string[];
  };

  it('are exactly the sentences the lessons say: run tools/voice again after changing a lesson text', () => {
    const wanted = speechEntries('vi')
      .map((e) => e.key)
      .sort();
    expect([...index.files].sort()).toEqual(wanted);
  });

  it('are all there, and not empty', () => {
    for (const key of index.files) {
      const file = join(dir, `${key}.mp3`);
      expect(existsSync(file), key).toBe(true);
      expect(statSync(file).size, key).toBeGreaterThan(1000);
    }
  });
});
