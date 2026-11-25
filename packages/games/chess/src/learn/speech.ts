import { voiceKey } from './voice-hash';

/**
 * Read-aloud. The lessons first play a **pre-recorded voice file** (an mp3 for every sentence a lesson can say,
 * made once with a free Vietnamese voice, see tools/voice/README.md): it sounds the same on every browser and
 * device. A sentence with no file, or a language with no recordings, falls back to the browser's own speech
 * synthesis. Nothing is sent anywhere.
 */
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Vietnamese voices read "d" and "g" both as "dê". Spell the files with their Vietnamese letter names instead
 * ("đê", "giê"), and "e4" as "e 4" so the voice says the letter and then the number.
 */
const VI_LETTERS: Record<string, string> = {
  a: 'a',
  b: 'bê',
  c: 'xê',
  d: 'đê',
  e: 'e',
  f: 'ép',
  g: 'giê',
  h: 'hát',
};
export const spellSquares = (text: string, lang = 'vi') =>
  text.replace(
    /\b([a-h])([1-8])\b/g,
    (_, file: string, rank: string) => `${lang === 'en' ? file : VI_LETTERS[file]} ${rank}`,
  );

const localeOf = (lang: string) => (lang === 'en' ? 'en-US' : 'vi-VN');

// ---------------------------------------------------------------------------------------------------------
// The recorded voice

/**
 * Where the recordings are served from: `/audio/<lang>-<VOICE_SET>/index.json` and `.../<key>.mp3`. Browsers keep the
 * files for a day, so a new recording of the same sentences goes to a new `VOICE_SET` (and tools/voice makes it there).
 */
export const VOICE_BASE = '/audio';
export const VOICE_SET = 'edge';
const voiceDir = (lang: string) => `${VOICE_BASE}/${lang}-${VOICE_SET}`;

/** Per language: the names of the files that exist; `null` once we know there are none. Missing = not asked yet. */
const packs = new Map<string, ReadonlySet<string> | null>();
const loading = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Calls `listener` when a recording list has been loaded; returns the way to stop. */
export function onVoicePack(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** True when the recordings of the language are known and there are some. */
export const hasVoicePack = (lang: string) => (packs.get(lang)?.size ?? 0) > 0;

/** Loads the list of recordings of a language once. Resolves with whether there are any. */
export function loadVoicePack(lang: string): Promise<boolean> {
  if (packs.has(lang)) return Promise.resolve(hasVoicePack(lang));
  const pending = loading.get(lang);
  if (pending) return pending;
  const request =
    typeof fetch === 'function' && typeof Audio !== 'undefined'
      ? fetch(`${voiceDir(lang)}/index.json`)
          .then((r) =>
            r.ok ? (r.json() as Promise<{ files?: unknown }>) : Promise.reject(new Error(String(r.status))),
          )
          .then((j) => {
            const files = Array.isArray(j.files)
              ? j.files.filter((f): f is string => typeof f === 'string')
              : [];
            packs.set(lang, files.length > 0 ? new Set(files) : null);
          })
          .catch(() => void packs.set(lang, null))
      : Promise.resolve(void packs.set(lang, null));
  const done = request.then(() => {
    loading.delete(lang);
    notify();
    return hasVoicePack(lang);
  });
  loading.set(lang, done);
  return done;
}

/** For tests: forget what was loaded. */
export function resetVoicePacks(): void {
  packs.clear();
  loading.clear();
  stopSpeaking();
}

let current: HTMLAudioElement | null = null;
const audioPlaying = () => current !== null && !current.paused && !current.ended;

/** Plays a recording. If the file cannot be played (missing, blocked) the browser voice says it instead. */
function playFile(url: string, fallback: () => void): void {
  stopSpeaking();
  const audio = new Audio(url);
  current = audio;
  audio.addEventListener('ended', () => {
    if (current === audio) current = null;
  });
  void audio.play().catch(() => {
    if (current === audio) current = null;
    fallback();
  });
}

// ---------------------------------------------------------------------------------------------------------
// The browser's voice (the fallback)

/** An installed voice for the language, best match first. */
export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  if (!canSpeak()) return undefined;
  const wanted = localeOf(lang).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  return voices.find((v) => norm(v) === wanted) ?? voices.find((v) => norm(v).startsWith(wanted.slice(0, 2)));
}

/** What the browser alone can do: 'unknown' while it has not listed its voices yet, 'no' when none speaks the language. */
function browserStatus(lang: string): 'yes' | 'no' | 'unknown' {
  if (!canSpeak()) return 'no';
  if (window.speechSynthesis.getVoices().length === 0) return 'unknown';
  return voiceFor(lang) ? 'yes' : 'no';
}

/**
 * Can this device read the language? 'yes' with recordings, whatever the browser. Without them it depends on the
 * browser: 'unknown' while it has not listed its voices (we still try), 'no' when none speaks the language (reading
 * Vietnamese with an English voice would be nonsense). 'unknown' too while the recordings are still being looked for.
 */
export function voiceStatus(lang: string): 'yes' | 'no' | 'unknown' {
  if (hasVoicePack(lang)) return 'yes';
  if (!packs.has(lang) && loading.has(lang)) return 'unknown';
  return browserStatus(lang);
}

function speakWithBrowser(text: string, lang: string): boolean {
  if (browserStatus(lang) === 'no') return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spellSquares(text, lang));
  const voice = voiceFor(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? localeOf(lang);
  utterance.rate = 0.85;
  synth.speak(utterance);
  return true;
}

/** Reads the text aloud: from the recording of that sentence if there is one, else with the browser's voice. Returns false when nothing was read. */
export function speak(text: string, lang: string): boolean {
  const key = voiceKey(spellSquares(text, lang));
  if (packs.get(lang)?.has(key) && typeof Audio !== 'undefined') {
    playFile(`${voiceDir(lang)}/${key}.mp3`, () => void speakWithBrowser(text, lang));
    return true;
  }
  return speakWithBrowser(text, lang);
}

export function stopSpeaking(): void {
  if (current) {
    current.pause();
    current = null;
  }
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Resolves when nothing is being spoken (or after `maxMs`): lets a lesson wait for the result before the next question. */
export function waitUntilSilent(maxMs = 9000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const busy = audioPlaying() || (canSpeak() && window.speechSynthesis.speaking);
      if (!busy || Date.now() - started > maxMs) resolve();
      else setTimeout(check, 200);
    };
    check();
  });
}
