import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import vi from '../src/i18n/vi.json';
import { coach, coachMove } from '../src/coach';
import { hintParts } from '../src/learn/hint-speech';
import { speechEntries, spokenForm } from '../src/learn/speech-texts';
import { squareName } from '../src/rules/board';
import { fen } from './helpers';

/**
 * Some sentences are said from recorded parts. Whatever is read must be the words on the screen: a child who
 * is learning to read follows them with the voice.
 */
const translator = (messages: unknown) => (key: string, values?: Record<string, string | number>) => {
  const text = key
    .replace(/^games\.chess\./, '')
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
  if (typeof text !== 'string') throw new Error(`missing ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
/** The words, without the punctuation that differs between a list and sentences read one by one. */
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Every pair of squares a piece can be moved between: along a line, or a knight's jump. */
const MOVES = Array.from({ length: 64 }, (_, from) =>
  Array.from({ length: 64 }, (_, to) => ({ from, to })).filter(({ to }) => {
    const dr = Math.abs((from >> 3) - (to >> 3));
    const df = Math.abs((from & 7) - (to & 7));
    return from !== to && (dr === 0 || df === 0 || dr === df || dr * df === 2);
  }),
).flat();

describe('what is said is what is shown', () => {
  for (const [lang, messages] of [
    ['vi', vi],
    ['en', en],
  ] as const) {
    const t = translator(messages);
    const recorded = new Set(speechEntries(lang).map((e) => e.spoken));

    it(`${lang}: both hints of a puzzle, for every move, from recorded parts`, () => {
      const wrong = new Set<string>();
      const unrecorded = new Set<string>();
      for (const move of MOVES) {
        for (const level of [1, 2]) {
          const { text, parts } = hintParts(t, move, level);
          // Word for word, with the same punctuation.
          if (parts.join(' ') !== text) wrong.add(`shown "${text}" said "${parts.join(' ')}"`);
          for (const p of parts) if (!recorded.has(spokenForm(p, lang))) unrecorded.add(p);
        }
      }
      expect([...wrong].slice(0, 3)).toEqual([]);
      expect([...unrecorded].slice(0, 3)).toEqual([]);
    });
  }

  // A voice reads a picture by its name in a character table ("sao trắng vừa" for ⭐), not as the word meant.
  it('gives the voice words, never a picture', () => {
    for (const lang of ['vi', 'en'] as const) {
      const pictures = speechEntries(lang).filter((e) => /\p{Extended_Pictographic}/u.test(e.spoken));
      expect(pictures.map((e) => e.spoken)).toEqual([]);
    }
    expect(spokenForm('Được thêm 2 ⭐.', 'vi')).toBe('Được thêm 2 ngôi sao.');
  });

  const t = translator(vi);

  it('the warning of the coach names every piece it shows', () => {
    // Three pieces in danger at once.
    const advice = coach.warn(fen('r5k1/8/7b/3p4/4Q3/N4P2/8/2R1K3 w - -'), 0)!;
    expect(advice.cells).toHaveLength(3);
    expect(words(advice.speech(t).join(' '))).toEqual(words(advice.text(t)));
  });

  it('the hint of the coach, for every reason', () => {
    const positions = [
      '6k1/5ppp/8/8/8/8/8/R5K1 w - -', // mate
      '4k3/8/8/3q4/8/2N5/8/4K3 w - -', // capture
      'r3k3/8/8/8/8/N7/8/4K3 w - -', // save
      '4k3/8/8/8/8/8/4P3/4K3 w - -', // good
    ];
    expect(positions.map((p) => coachMove(fen(p))!.reason)).toEqual(['mate', 'capture', 'save', 'good']);
    for (const p of positions) {
      const advice = coach.hint(fen(p), 0)!;
      expect(words(advice.speech(t).join(' ')), squareName(advice.cells[0]!)).toEqual(words(advice.text(t)));
    }
  });
});
