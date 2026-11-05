import { describe, expect, it } from 'vitest';
import { SCORES } from '../src/sound/orchestra/scores';
import { NOTE } from '../src/sound/synth';

const tokens = (line: string) =>
  line
    .trim()
    .split(/\s+/)
    .map((t) => {
      const [name, len] = t.split('/');
      return { name: name!.replace('~', ''), beats: Number(len) };
    });

/** Comfortable written ranges (Hz) for whoever may play each line. */
const RANGE: Record<string, [number, number]> = {
  flute: [NOTE('C4'), NOTE('C7')],
  violins: [NOTE('G3'), NOTE('E7')],
  clarinet: [NOTE('D3'), NOTE('C6')],
  horn: [NOTE('B1'), NOTE('F5')],
  cellos: [NOTE('C2'), NOTE('A5')],
};

describe('background music scores', () => {
  for (const [mood, score] of Object.entries(SCORES)) {
    it(`${mood} ("${score.title}"): every bar adds up and every note is playable`, () => {
      expect(score.bars.length).toBeGreaterThanOrEqual(16);
      for (const [i, bar] of score.bars.entries()) {
        for (const line of [bar.melody, bar.counter].filter((l): l is string => !!l)) {
          const notes = tokens(line);
          expect(
            notes.reduce((s, n) => s + n.beats, 0),
            `bar ${i + 1}: ${line}`,
          ).toBe(score.beats);
          for (const n of notes) if (n.name !== '-') expect(Number.isFinite(NOTE(n.name))).toBe(true);
        }
        for (const part of bar.chord.split('|')) {
          const tones = part.trim().split(/\s+/).map(NOTE);
          expect(tones.length, `bar ${i + 1}`).toBeGreaterThanOrEqual(2);
          // Bass first, then the chord above it.
          expect(Math.min(...tones)).toBe(tones[0]);
        }
        // Whoever gets the tune can play it.
        for (const inst of score.melodyBy) {
          const [lo, hi] = RANGE[inst]!;
          for (const n of tokens(bar.melody))
            if (n.name !== '-')
              expect(NOTE(n.name), `${inst} bar ${i + 1} ${n.name}`).toBeGreaterThanOrEqual(lo);
          for (const n of tokens(bar.melody))
            if (n.name !== '-') expect(NOTE(n.name)).toBeLessThanOrEqual(hi);
        }
        if (bar.counter) {
          const [lo, hi] = RANGE[score.counterBy]!;
          for (const n of tokens(bar.counter)) {
            expect(NOTE(n.name), `counter bar ${i + 1} ${n.name}`).toBeGreaterThanOrEqual(lo);
            expect(NOTE(n.name)).toBeLessThanOrEqual(hi);
          }
        }
      }
    });
  }

  it('the folk tune keeps to the "điệu Bắc" pentatonic C D F G A', () => {
    const allowed = new Set(['C', 'D', 'F', 'G', 'A']);
    for (const bar of SCORES.folk.bars)
      for (const n of tokens(bar.melody))
        if (n.name !== '-') expect(allowed.has(n.name.replace(/\d/, ''))).toBe(true);
  });
});
