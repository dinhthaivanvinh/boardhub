'use client';

import type { MusicMood } from '@bg/ui';
import type { AudioGraph } from './engine';
import {
  clarinet,
  flute,
  harp,
  horn,
  strings,
  timpaniRoll,
  waves,
  type Instrument,
  type Note,
} from './orchestra/instruments';
import { SCORES, type Bar, type Score } from './orchestra/scores';
import { NOTE } from './synth';

/*
 * Background music: a small synthesised orchestra playing short original pieces (orchestra/scores.ts)
 * in a concert-hall reverb. Each pass round the piece gives the tune to another instrument, and every
 * note is slightly humanised, so it does not sound like a machine loop. Quiet by design (docs/08 §10).
 */

/** How loud each instrument plays the tune (they differ in how loud they sound at the same gain). */
const LEAD: Record<Instrument, number> = {
  flute: 0.07,
  violins: 0.055,
  violas: 0.05,
  cellos: 0.06,
  basses: 0.05,
  clarinet: 0.045,
  horn: 0.05,
  harp: 0.06,
};

interface Ctx {
  ctx: BaseAudioContext;
  dest: AudioNode;
  noise: AudioBuffer;
}

const human = (x: number, amount = 0.08) => x * (1 + (Math.random() * 2 - 1) * amount);
const jitter = () => (Math.random() - 0.5) * 0.024;

function play(c: Ctx, inst: Instrument, n: Note, attack?: number) {
  switch (inst) {
    case 'violins':
    case 'violas':
    case 'cellos':
    case 'basses':
      return strings(c.ctx, c.dest, inst, n, attack);
    case 'horn':
      return horn(c.ctx, c.dest, n);
    case 'flute':
      return flute(c.ctx, c.dest, c.noise, n);
    case 'clarinet':
      return clarinet(c.ctx, c.dest, n);
    case 'harp':
      return harp(c.ctx, c.dest, n);
  }
}

/** "F#5/2 -/1 A4~/1" → notes with start beat, length and grace flag. */
function parseLine(line: string) {
  let beat = 0;
  const out: { beat: number; beats: number; note: string; grace: boolean }[] = [];
  for (const token of line.trim().split(/\s+/)) {
    const [name, len] = token.split('/');
    const beats = Number(len);
    if (name !== '-') out.push({ beat, beats, note: name!.replace('~', ''), grace: name!.includes('~') });
    beat += beats;
  }
  return out;
}

/** "D2 A2 D3 | A1 E2" → one or two chords, each with its share of the bar. */
function chordsOf(bar: Bar, beats: number) {
  const parts = bar.chord.split('|').map((p) => p.trim().split(/\s+/).map(NOTE));
  const each = beats / parts.length;
  return parts.map((tones, i) => ({ beat: i * each, beats: each, bass: tones[0]!, upper: tones.slice(1) }));
}

/** Schedules one bar starting at `at` (seconds). `pass` = how many times round the piece. */
export function scheduleBar(c: Ctx, score: Score, index: number, pass: number, at: number): void {
  const bar = score.bars[index]!;
  const beat = 60 / score.bpm;
  const lift = bar.lift ? 1.2 : 1;
  const lead = score.melodyBy[pass % score.melodyBy.length]!;

  // The tune.
  for (const m of parseLine(bar.melody)) {
    const t = at + m.beat * beat + jitter();
    const freq = NOTE(m.note);
    const vel = human(LEAD[lead] * lift);
    if (m.grace) play(c, lead, { at: t - 0.09, freq: freq * 2 ** (2 / 12), dur: 0.08, vel: vel * 0.6 });
    play(c, lead, { at: t, freq, dur: m.beats * beat * 0.95, vel }, 0.1);
  }
  // A second line under it, from the second time round (the first pass is kept simple).
  if (bar.counter && pass > 0) {
    for (const m of parseLine(bar.counter))
      play(
        c,
        score.counterBy,
        {
          at: at + m.beat * beat + jitter(),
          freq: NOTE(m.note),
          dur: m.beats * beat * 0.97,
          vel: human(LEAD[score.counterBy] * 0.55 * lift),
        },
        0.3,
      );
  }

  for (const ch of chordsOf(bar, score.beats)) {
    const start = at + ch.beat * beat;
    const len = ch.beats * beat;
    // Sustained harmony: basses on the root, violas on the chord.
    strings(c.ctx, c.dest, 'basses', { at: start, freq: ch.bass, dur: len, vel: human(0.04 * lift) }, 0.35);
    for (const f of ch.upper)
      strings(
        c.ctx,
        c.dest,
        'violas',
        { at: start + jitter(), freq: f, dur: len, vel: human(0.016 * lift) },
        0.8,
      );

    if (score.accompaniment === 'pastoral') {
      // Harp in flowing eighths, an octave up, rising and falling through the chord.
      const tones = ch.upper.map((f) => f * 2);
      const order = [...tones, ...tones.slice(1, -1).reverse()];
      for (let i = 0; i < ch.beats * 2; i++)
        harp(c.ctx, c.dest, {
          at: start + i * beat * 0.5 + jitter(),
          freq: order[i % order.length]!,
          dur: 0,
          vel: human(0.032),
        });
    } else if (score.accompaniment === 'folk') {
      // Zither-like: the chord rolled on the first beat, a small answer in the middle, top note slid into.
      ch.upper.forEach((f, i) =>
        harp(
          c.ctx,
          c.dest,
          { at: start + i * 0.09, freq: f * 2, dur: 0, vel: human(0.035) },
          i === ch.upper.length - 1 ? 80 : 0,
        ),
      );
      if (ch.beats >= 3) {
        const mid = start + Math.floor(ch.beats / 2) * beat;
        harp(
          c.ctx,
          c.dest,
          { at: mid, freq: ch.upper[ch.upper.length - 1]! * 2, dur: 0, vel: human(0.028) },
          60,
        );
        harp(c.ctx, c.dest, { at: mid + beat * 0.5, freq: ch.upper[0]! * 2, dur: 0, vel: human(0.024) });
      }
    } else {
      // Sea: the cellos rock on the beats after the downbeat, like a boat on the swell.
      for (let b = 1; b < ch.beats; b++)
        strings(
          c.ctx,
          c.dest,
          'cellos',
          {
            at: start + b * beat + jitter(),
            freq: ch.upper[(b - 1) % ch.upper.length]!,
            dur: beat * 0.9,
            vel: human(0.03 * lift),
          },
          0.12,
        );
    }
  }

  if (bar.roll)
    timpaniRoll(c.ctx, c.dest, c.noise, {
      at,
      freq: NOTE(score.accompaniment === 'sea' ? 'D2' : 'A1'),
      dur: score.beats * beat,
      vel: 0.12,
    });
  if (score.accompaniment === 'sea' && index % 2 === 0)
    waves(c.ctx, c.dest, c.noise, at, score.beats * beat * 2.2, 0.035);
}

/** A concert-hall tail for the orchestra: longer and softer than the effects' room. */
function hall(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
  const seconds = 2.8;
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2;
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const pre = ctx.createDelay();
  pre.delayTime.value = 0.025;
  const wet = ctx.createGain();
  wet.gain.value = 0.42;
  pre.connect(conv).connect(wet).connect(dest);
  return pre;
}

/** The orchestra's own chain: dry + hall → gentle compressor → `out`. */
export function orchestraBus(ctx: BaseAudioContext, out: AudioNode): GainNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  comp.attack.value = 0.05;
  comp.release.value = 0.4;
  comp.connect(out);
  const input = ctx.createGain();
  input.connect(comp);
  input.connect(hall(ctx, comp));
  return input;
}

const LOOKAHEAD = 2;

/** Starts the music for a mood; returns a function that fades it out and stops it. */
export function startMusic(g: AudioGraph, mood: MusicMood): (fadeSeconds?: number) => void {
  const { ctx } = g;
  const score = SCORES[mood];
  const barSeconds = (score.beats * 60) / score.bpm;
  const fader = ctx.createGain();
  fader.gain.setValueAtTime(0.0001, ctx.currentTime);
  fader.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3);
  fader.connect(g.music);
  const c: Ctx = { ctx, dest: orchestraBus(ctx, fader), noise: g.noise };

  let index = 0;
  let pass = 0;
  let next = ctx.currentTime + 0.15;
  const tick = () => {
    while (next < ctx.currentTime + LOOKAHEAD) {
      scheduleBar(c, score, index, pass, next);
      next += barSeconds;
      index++;
      if (index >= score.bars.length) {
        index = 0;
        pass++;
        // A breath between passes.
        next += barSeconds * 0.5;
      }
    }
  };
  tick();
  const timer = window.setInterval(tick, 250);

  return (fadeSeconds = 2) => {
    window.clearInterval(timer);
    const t = ctx.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(Math.max(fader.gain.value, 0.0001), t);
    fader.gain.exponentialRampToValueAtTime(0.0001, t + fadeSeconds);
    // Notes already scheduled play on silently and end by themselves; then the chain is let go.
    window.setTimeout(() => fader.disconnect(), (fadeSeconds + LOOKAHEAD + 4) * 1000);
  };
}
