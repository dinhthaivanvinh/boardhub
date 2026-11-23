/** Read-aloud with the browser's own speech synthesis; nothing is sent anywhere. */
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

/** An installed voice for the language, best match first. */
export function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  if (!canSpeak()) return undefined;
  const wanted = localeOf(lang).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  return voices.find((v) => norm(v) === wanted) ?? voices.find((v) => norm(v).startsWith(wanted.slice(0, 2)));
}

/**
 * Can this device read the language? 'unknown' while the browser has not listed its voices yet: then we still
 * try, setting the language on the utterance. 'no' when voices are listed but none speaks it: reading the text
 * with a voice of another language would be nonsense (Vietnamese read by an English voice).
 */
export function voiceStatus(lang: string): 'yes' | 'no' | 'unknown' {
  if (!canSpeak()) return 'no';
  if (window.speechSynthesis.getVoices().length === 0) return 'unknown';
  return voiceFor(lang) ? 'yes' : 'no';
}

/** Reads the text aloud. Returns false when nothing was read (no voice for the language). */
export function speak(text: string, lang: string): boolean {
  if (voiceStatus(lang) === 'no') return false;
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

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
