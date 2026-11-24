import { describe, expect, it } from 'vitest';
import { speechEntries, speechTexts } from '../src/learn/speech-texts';
import { voiceKey } from '../src/learn/voice-hash';

describe('the list of sentences the lessons say', () => {
  for (const lang of ['vi', 'en'] as const) {
    it(`${lang}: is built without a missing text or an unfilled placeholder`, () => {
      const texts = speechTexts(lang);
      expect(texts.length).toBeGreaterThan(200);
      for (const t of texts) expect(t, t).not.toMatch(/\{\w+\}/);
    });

    it(`${lang}: gives every sentence its own file name`, () => {
      const entries = speechEntries(lang);
      expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    });
  }

  it('spells the squares the way the voice should say them (Vietnamese)', () => {
    const spoken = speechEntries('vi').map((e) => e.spoken);
    expect(spoken.some((s) => /\bđê 3\b|\bgiê \d\b|\bxê \d\b/.test(s))).toBe(true);
    expect(spoken.some((s) => /\b[a-h][1-8]\b/.test(s))).toBe(false);
  });

  it('the file name never changes: a change would orphan every recorded file', () => {
    expect(voiceKey('Đúng rồi!')).toBe(voiceKey('Đúng rồi!'));
    // Pinned values: if these change, the voice files must be made again.
    expect(voiceKey('')).toBe('0bdcb81aee8d83');
    expect(voiceKey('a')).toMatch(/^[0-9a-f]{14}$/);
  });
});
