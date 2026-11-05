'use client';

import type { AudioGraph } from './engine';

/*
 * Every sound is synthesised (Web Audio): no audio files, nothing to license, nothing to download.
 * Small random variations keep repeated sounds (many moves in a row) from sounding mechanical.
 */

export type AppSound =
  | 'place'
  | 'drop'
  | 'move'
  | 'capture'
  | 'flip'
  | 'check'
  | 'pick'
  | 'sow'
  | 'splash'
  | 'hit'
  | 'sunk'
  | 'ready'
  | 'invalid'
  | 'start'
  | 'win'
  | 'lose'
  | 'draw'
  | 'clock'
  | 'chat';

const vary = (x: number, amount = 0.06) => x * (1 + (Math.random() * 2 - 1) * amount);

/** A gain envelope: silent → peak in `attack` s → near silence after `decay` s. */
function envelope(g: AudioGraph, at: number, peak: number, attack: number, decay: number): GainNode {
  const gain = g.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return gain;
}

function out(g: AudioGraph, node: AudioNode, reverb = 0) {
  node.connect(g.effects);
  if (reverb > 0) {
    const send = g.ctx.createGain();
    send.gain.value = reverb;
    node.connect(send).connect(g.reverb);
  }
}

/** A tone whose pitch can glide from `freq` to `to`. */
function tone(
  g: AudioGraph,
  at: number,
  o: {
    freq: number;
    to?: number;
    glide?: number;
    type?: OscillatorType;
    peak: number;
    attack?: number;
    decay: number;
    reverb?: number;
    filter?: number;
  },
) {
  const osc = g.ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + (o.glide ?? o.decay));
  const env = envelope(g, at, o.peak, o.attack ?? 0.004, o.decay);
  let node: AudioNode = osc.connect(env);
  if (o.filter) {
    const lp = g.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.filter;
    node = node.connect(lp);
  }
  out(g, node, o.reverb);
  osc.start(at);
  osc.stop(at + (o.attack ?? 0.004) + o.decay + 0.05);
}

/** Filtered noise: clicks, swishes, splashes and explosions. */
function noise(
  g: AudioGraph,
  at: number,
  o: {
    type: BiquadFilterType;
    freq: number;
    to?: number;
    q?: number;
    peak: number;
    attack?: number;
    decay: number;
    reverb?: number;
    drive?: boolean;
  },
) {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  const filter = g.ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.setValueAtTime(o.freq, at);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, at + o.decay);
  filter.Q.value = o.q ?? 0.8;
  const env = envelope(g, at, o.peak, o.attack ?? 0.002, o.decay);
  let node: AudioNode = src.connect(filter);
  if (o.drive) {
    const shaper = g.ctx.createWaveShaper();
    shaper.curve = driveCurve();
    node = node.connect(shaper);
  }
  out(g, node.connect(env), o.reverb);
  src.start(at, Math.random() * 1.5);
  src.stop(at + (o.attack ?? 0.002) + o.decay + 0.05);
}

let curve: Float32Array<ArrayBuffer> | null = null;
function driveCurve() {
  if (curve) return curve;
  curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(3 * x);
  }
  return curve;
}

/** A bell: a few inharmonic partials that die away. */
export function bell(g: AudioGraph, at: number, freq: number, peak: number, decay: number, dest?: AudioNode) {
  for (const [ratio, level] of [
    [1, 1],
    [2.76, 0.28],
    [5.4, 0.09],
  ] as const) {
    const osc = g.ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const env = envelope(g, at, peak * level, 0.005, decay / ratio ** 0.5);
    osc.connect(env);
    if (dest) env.connect(dest);
    else out(g, env, 0.35);
    osc.start(at);
    osc.stop(at + decay + 0.1);
  }
}

/** Wood on wood: a click and a short hollow body. Lower `body` = heavier piece. */
function knock(g: AudioGraph, at: number, body: number, level: number) {
  noise(g, at, { type: 'bandpass', freq: vary(3000, 0.15), q: 1.2, peak: 0.35 * level, decay: 0.03 });
  tone(g, at, { freq: vary(body * 1.35), to: body, glide: 0.06, peak: 0.55 * level, decay: 0.09 });
}

function bubbles(g: AudioGraph, at: number, n: number, level: number) {
  for (let i = 0; i < n; i++) {
    const t = at + 0.08 + Math.random() * 0.5;
    const f = 380 + Math.random() * 500;
    tone(g, t, { freq: f, to: f * 2.2, glide: 0.05, peak: 0.08 * level, decay: 0.06 });
  }
}

function explosion(g: AudioGraph, at: number, size: number) {
  noise(g, at, {
    type: 'lowpass',
    freq: 1500,
    to: 160,
    peak: 0.9 * size,
    decay: 0.9 * size,
    reverb: 0.5,
    drive: true,
  });
  tone(g, at, { freq: 95, to: 32, glide: 0.5, peak: 0.9 * size, decay: 0.6 * size });
  // Crackle of debris.
  for (let i = 0; i < 5; i++)
    noise(g, at + 0.05 + Math.random() * 0.35, {
      type: 'bandpass',
      freq: 1800 + Math.random() * 2000,
      q: 2,
      peak: 0.12 * size,
      decay: 0.03,
    });
}

const NOTE = (n: string) => {
  const names: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(m[3]) + 1) + names[m[1]!]! + shift;
  return 440 * 2 ** ((midi - 69) / 12);
};
export { NOTE };

/** Plays one sound now (or `delay` seconds from now). `count` repeats flips. */
export function synth(g: AudioGraph, sound: AppSound, delay = 0, count = 1): void {
  const at = g.ctx.currentTime + 0.01 + delay;
  switch (sound) {
    case 'place':
      knock(g, at, 170, 1);
      return;
    case 'drop':
      // A disc rattles down the column and settles with two small bounces.
      noise(g, at, { type: 'bandpass', freq: 1400, to: 900, q: 3, peak: 0.08, attack: 0.04, decay: 0.12 });
      tone(g, at + 0.13, { freq: vary(560), to: 380, glide: 0.05, type: 'triangle', peak: 0.4, decay: 0.07 });
      tone(g, at + 0.21, {
        freq: vary(500),
        to: 360,
        glide: 0.04,
        type: 'triangle',
        peak: 0.16,
        decay: 0.05,
      });
      return;
    case 'move':
      // A short slide across the board, then the piece is set down.
      noise(g, at, { type: 'lowpass', freq: 1100, peak: 0.08, attack: 0.03, decay: 0.07 });
      knock(g, at + 0.07, 150, 0.9);
      return;
    case 'capture':
      noise(g, at, { type: 'lowpass', freq: 1100, peak: 0.08, attack: 0.03, decay: 0.06 });
      knock(g, at + 0.06, 115, 1.2);
      // The taken piece clatters aside.
      noise(g, at + 0.13, { type: 'bandpass', freq: 2200, q: 1.5, peak: 0.25, decay: 0.05 });
      tone(g, at + 0.13, { freq: 260, to: 190, glide: 0.05, peak: 0.22, decay: 0.06 });
      return;
    case 'flip':
      for (let i = 0; i < Math.min(count, 12); i++)
        tone(g, at + i * 0.055, {
          freq: 720 + i * 55,
          to: 980 + i * 55,
          glide: 0.03,
          type: 'triangle',
          peak: 0.18,
          decay: 0.05,
        });
      return;
    case 'check':
      bell(g, at, NOTE('A5'), 0.22, 0.9);
      bell(g, at + 0.13, NOTE('E6'), 0.16, 0.9);
      return;
    case 'pick':
      noise(g, at, { type: 'lowpass', freq: 1400, peak: 0.25, attack: 0.03, decay: 0.12 });
      for (let i = 0; i < 3; i++)
        tone(g, at + 0.03 + i * 0.03, { freq: vary(2400, 0.2), peak: 0.12, decay: 0.025 });
      return;
    case 'sow':
      // One small stone (a pebble or a seed) lands in a wooden hollow.
      noise(g, at, { type: 'bandpass', freq: vary(4200, 0.15), q: 2, peak: 0.16, decay: 0.02 });
      tone(g, at, { freq: vary(1900, 0.15), to: 1500, glide: 0.03, peak: 0.2, decay: 0.05 });
      return;
    case 'splash':
      noise(g, at, {
        type: 'lowpass',
        freq: 2600,
        to: 280,
        peak: 0.55,
        attack: 0.01,
        decay: 0.75,
        reverb: 0.3,
      });
      noise(g, at, { type: 'highpass', freq: 3000, peak: 0.12, attack: 0.01, decay: 0.25 });
      bubbles(g, at, 5, 1);
      return;
    case 'hit':
      explosion(g, at, 0.85);
      return;
    case 'sunk':
      explosion(g, at, 0.95);
      // The hull groans and goes under.
      tone(g, at + 0.2, {
        freq: 170,
        to: 60,
        glide: 1.5,
        type: 'sawtooth',
        peak: 0.16,
        attack: 0.2,
        decay: 1.4,
        filter: 500,
        reverb: 0.4,
      });
      bubbles(g, at + 0.8, 8, 1);
      return;
    case 'ready':
      knock(g, at, 160, 0.7);
      knock(g, at + 0.12, 180, 0.7);
      bell(g, at + 0.3, NOTE('G5'), 0.12, 0.8);
      bell(g, at + 0.42, NOTE('C6'), 0.12, 1.1);
      return;
    case 'invalid':
      tone(g, at, { freq: 150, type: 'square', peak: 0.12, decay: 0.09, filter: 700 });
      tone(g, at + 0.11, { freq: 118, type: 'square', peak: 0.12, decay: 0.12, filter: 700 });
      return;
    case 'start':
      bell(g, at, NOTE('C5'), 0.14, 1.2);
      bell(g, at + 0.16, NOTE('G5'), 0.12, 1.4);
      return;
    case 'clock':
      tone(g, at, { freq: 1250, peak: 0.25, decay: 0.03 });
      noise(g, at, { type: 'bandpass', freq: 3500, q: 3, peak: 0.12, decay: 0.015 });
      return;
    case 'chat':
      tone(g, at, { freq: 620, to: 940, glide: 0.06, peak: 0.12, decay: 0.08 });
      return;
    case 'win': {
      // A rising arpeggio, then the whole chord rings, with a little sparkle on top.
      const notes = ['C5', 'E5', 'G5', 'C6'];
      notes.forEach((n, i) => bell(g, at + i * 0.11, NOTE(n), 0.2, 0.7));
      for (const n of [...notes, 'E6']) bell(g, at + 0.5, NOTE(n), 0.11, 2.2);
      noise(g, at + 0.5, { type: 'highpass', freq: 7000, peak: 0.05, attack: 0.05, decay: 1.4, reverb: 0.6 });
      return;
    }
    case 'lose':
      // Gentle and falling, not a buzzer: losing should not feel like a punishment.
      ['A4', 'F4', 'D4'].forEach((n, i) =>
        tone(g, at + i * 0.34, {
          freq: NOTE(n),
          type: 'triangle',
          peak: 0.2,
          attack: 0.02,
          decay: 0.6,
          filter: 1800,
          reverb: 0.4,
        }),
      );
      for (const n of ['D3', 'A3', 'F4'])
        tone(g, at + 1.02, {
          freq: NOTE(n),
          type: 'triangle',
          peak: 0.08,
          attack: 0.15,
          decay: 1.6,
          filter: 1200,
          reverb: 0.5,
        });
      return;
    case 'draw':
      bell(g, at, NOTE('G4'), 0.16, 1);
      bell(g, at + 0.3, NOTE('C5'), 0.16, 1.6);
      return;
  }
}
