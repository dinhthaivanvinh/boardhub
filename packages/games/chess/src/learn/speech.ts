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

export function speak(text: string, lang: string): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spellSquares(text, lang));
  utterance.lang = lang === 'en' ? 'en-US' : 'vi-VN';
  utterance.rate = 0.85;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
