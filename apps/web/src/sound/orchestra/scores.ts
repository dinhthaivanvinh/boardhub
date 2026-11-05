import type { MusicMood } from '@bg/ui';
import type { Instrument } from './instruments';

/*
 * Three short original pieces for the synthesised orchestra (docs/08 §10). Written for this project
 * (no existing tune is quoted). Each loops, and every time round another instrument takes the tune.
 *
 * Notation, one entry per bar:
 *   chord   "bass voicing…", or two chords in the bar: "E2 B2 G3 | A1 E2 C#3 G3"
 *   melody  "F#5/2 E5/1 D5/1"  note/beats; "-/1" is a rest; "A4~/2" adds a grace note from above (láy)
 */

export interface Bar {
  chord: string;
  melody: string;
  /** A second line under the tune (horn or cellos), same notation. */
  counter?: string;
  /** A soft timpani roll across the bar. */
  roll?: boolean;
  /** Louder bars (the middle section). */
  lift?: boolean;
}

export interface Score {
  title: string;
  bpm: number;
  beats: number;
  /** Who plays the tune on each pass through the piece. */
  melodyBy: Instrument[];
  counterBy: Instrument;
  accompaniment: 'pastoral' | 'folk' | 'sea';
  bars: Bar[];
}

/** "Buổi sáng trên bàn cờ": a calm pastorale in D major (chess, xiangqi, caro, reversi, four in a row). */
const PASTORALE: Score = {
  title: 'Pastorale in D',
  bpm: 70,
  beats: 4,
  melodyBy: ['flute', 'violins', 'clarinet', 'violins'],
  counterBy: 'horn',
  accompaniment: 'pastoral',
  bars: [
    { chord: 'D2 A2 D3 F#3 A3', melody: 'F#5/2 E5/1 D5/1' },
    { chord: 'C#2 A2 E3 A3', melody: 'E5/3 C#5/1' },
    { chord: 'B1 F#2 B2 D3 F#3', melody: 'D5/2 B4/1 C#5/1' },
    { chord: 'A1 F#2 A2 C#3 F#3', melody: 'A4/4' },
    { chord: 'G1 D2 G2 B2 D3', melody: 'B4/1 C#5/1 D5/1 B4/1' },
    { chord: 'F#1 D2 A2 D3 F#3', melody: 'A4/2 F#4/1 A4/1' },
    { chord: 'E2 B2 D3 G3', melody: 'G4/1 B4/1 E5/1 D5/1' },
    { chord: 'A1 E2 A2 C#3 G3', melody: 'C#5/4' },
    { chord: 'D2 A2 D3 F#3 A3', melody: 'A5/2 F#5/1 D5/1', counter: 'F#4/4' },
    { chord: 'C#2 A2 E3 A3', melody: 'E5/2 A4/1 C#5/1', counter: 'E4/4' },
    { chord: 'B1 F#2 B2 D3 F#3', melody: 'D5/1 F#5/1 B5/1 A5/1', counter: 'D4/4' },
    { chord: 'A1 F#2 A2 C#3 F#3', melody: 'F#5/3 E5/1', counter: 'C#4/4' },
    { chord: 'G1 D2 G2 B2 D3', melody: 'D5/1 E5/1 F#5/1 G5/1', counter: 'B3/4' },
    { chord: 'F#1 D2 A2 D3 F#3', melody: 'A5/2 F#5/1 D5/1', counter: 'A3/4' },
    { chord: 'E2 B2 G3 | A1 E2 C#3 G3', melody: 'E5/2 C#5/1 E5/1', counter: 'G3/2 A3/2' },
    { chord: 'D2 A2 D3 F#3 A3', melody: 'D5/4', counter: 'F#3/4' },
    { chord: 'G1 G2 B2 D3', melody: 'B4/2 D5/1 G5/1', lift: true, counter: 'D4/4' },
    { chord: 'A1 A2 C#3 E3', melody: 'F#5/2 E5/2', lift: true, counter: 'C#4/4' },
    { chord: 'F#1 F#2 A2 C#3', melody: 'C#5/1 E5/1 A5/2', lift: true, counter: 'A3/4' },
    { chord: 'B1 B2 D3 F#3', melody: 'F#5/4', lift: true, counter: 'B3/2 D4/2', roll: true },
    { chord: 'E2 B2 E3 G3', melody: 'G5/2 F#5/1 E5/1', lift: true, counter: 'E4/4' },
    { chord: 'F#1 D2 A2 D3', melody: 'D5/2 A4/2', lift: true, counter: 'D4/2 F#4/2' },
    { chord: 'G1 D2 G2 B2', melody: 'B4/1 D5/1 E5/1 G5/1', counter: 'G4/4' },
    { chord: 'A1 E2 A2 C#3 E3', melody: 'E5/3 -/1', counter: 'A3/2 C#4/2' },
  ],
};

/**
 * "Làng quê": Vietnamese "điệu Bắc" pentatonic (C D F G A) on the flute like a bamboo sáo, over a
 * zither-like harp and a quiet string drone (Ô ăn quan, Cờ gánh).
 */
const FOLK: Score = {
  title: 'Làng quê',
  bpm: 62,
  beats: 4,
  melodyBy: ['flute', 'violins', 'flute', 'clarinet'],
  counterBy: 'cellos',
  accompaniment: 'folk',
  bars: [
    { chord: 'C2 G2 C3 G3', melody: 'G4/1.5 A4/0.5 C5/2' },
    { chord: 'C2 G2 C3 G3', melody: 'D5/1 C5/1 A4~/2' },
    { chord: 'F1 C2 F2 G2 C3', melody: 'C5/1.5 D5/0.5 F5/1 D5/1' },
    { chord: 'C2 G2 C3 G3', melody: 'C5~/3 -/1' },
    { chord: 'A1 E2 G2 C3', melody: 'A4/1 C5/1 D5/1 C5/1' },
    { chord: 'G1 D2 G2 C3 D3', melody: 'G4~/2 F4/1 G4/1' },
    { chord: 'D2 A2 C3 F3', melody: 'D4/1 F4/1 G4/1 A4/1' },
    { chord: 'C2 G2 C3 G3', melody: 'G4/4' },
    { chord: 'F1 C2 F2 G2 C3', melody: 'F5/2 D5/1 F5/1', counter: 'F3/2 C3/2', lift: true },
    { chord: 'C2 G2 C3 G3', melody: 'G5~/2 F5/1 D5/1', counter: 'G3/4', lift: true },
    { chord: 'D2 A2 C3 F3', melody: 'C5/1 D5/1 F5/1 G5/1', counter: 'A3/2 F3/2', lift: true },
    { chord: 'A1 E2 G2 C3', melody: 'A5~/3 G5/1', counter: 'E3/4', lift: true, roll: true },
    { chord: 'F1 C2 F2 G2 C3', melody: 'F5/1 G5/1 F5/1 D5/1', counter: 'C3/4' },
    { chord: 'C2 G2 C3 G3', melody: 'C5/2 A4/1 C5/1', counter: 'G3/2 E3/2' },
    { chord: 'G1 D2 G2 C3 D3', melody: 'D5/1.5 C5/0.5 A4/1 G4/1', counter: 'D3/4' },
    { chord: 'C2 G2 C3 G3', melody: 'C5~/4', counter: 'C3/4' },
  ],
};

/** "Ra khơi": D minor, a slow rocking 3/4 with horn calls, rolling cellos and waves (Bắn tàu). */
const SEA: Score = {
  title: 'Ra khơi',
  bpm: 84,
  beats: 3,
  melodyBy: ['horn', 'violins', 'horn', 'cellos'],
  counterBy: 'flute',
  accompaniment: 'sea',
  bars: [
    { chord: 'D2 A2 D3 F3 A3', melody: 'D4/2 A4/1', roll: true },
    { chord: 'D2 A2 D3 F3 A3', melody: 'F4/3' },
    { chord: 'Bb1 F2 Bb2 D3 F3', melody: 'D4/1 F4/1 Bb4/1' },
    { chord: 'C2 G2 C3 E3 G3', melody: 'A4/2 G4/1' },
    { chord: 'D2 A2 D3 F3 A3', melody: 'F4/1 E4/1 D4/1' },
    { chord: 'Bb1 G2 Bb2 D3 G3', melody: 'G4/2 Bb4/1' },
    { chord: 'A1 E2 A2 C#3 E3', melody: 'A4/3' },
    { chord: 'A1 E2 A2 C#3 E3', melody: '-/2 A3/1' },
    { chord: 'D2 A2 D3 F3 A3', melody: 'D5/2 C5/1', counter: 'F5/3', lift: true, roll: true },
    { chord: 'Bb1 F2 Bb2 D3 F3', melody: 'Bb4/2 A4/1', counter: 'D5/3', lift: true },
    { chord: 'F1 C2 F2 A2 C3', melody: 'A4/1 G4/1 F4/1', counter: 'C5/3', lift: true },
    { chord: 'C2 G2 C3 E3 G3', melody: 'E4/2 G4/1', counter: 'G4/3', lift: true },
    { chord: 'D2 A2 D3 F3 A3', melody: 'F4/2 A4/1', counter: 'A4/3' },
    { chord: 'G1 D2 G2 Bb2 D3', melody: 'G4/1 Bb4/1 D5/1', counter: 'Bb4/3' },
    { chord: 'A1 E2 G2 C#3 E3', melody: 'C#5/2 E5/1', counter: 'E5/3', roll: true },
    { chord: 'D2 A2 D3 F3 A3', melody: 'D5/3', counter: 'F5/3' },
  ],
};

export const SCORES: Record<MusicMood, Score> = { calm: PASTORALE, folk: FOLK, sea: SEA };
