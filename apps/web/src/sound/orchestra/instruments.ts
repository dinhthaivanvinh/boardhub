'use client';

/*
 * A small synthesised orchestra (docs/08 §10). Each instrument is a recipe of oscillators, filters and
 * envelopes shaped after the real one:
 * - strings: several slightly detuned sawtooth "players" per note (an ensemble, not one violin), soft
 *   attack, vibrato that starts a moment after the note, warm low-pass
 * - horn: brassy sawtooth whose brightness blooms then settles
 * - flute: a pure tone with breath noise and gentle vibrato (doubles as the bamboo "sáo")
 * - clarinet: hollow square wave
 * - harp: plucked, ringing partials (doubles as the "đàn tranh" zither)
 * - timpani: tuned drum with a falling pitch and a soft thump
 * Everything is in seconds and Hz; `vel` is the peak gain of the note.
 */

export type Instrument = 'violins' | 'violas' | 'cellos' | 'basses' | 'horn' | 'flute' | 'clarinet' | 'harp';

export interface Note {
  at: number;
  freq: number;
  dur: number;
  vel: number;
}

const PAN: Record<Instrument, number> = {
  violins: -0.35,
  violas: -0.1,
  cellos: 0.25,
  basses: 0.35,
  horn: 0.15,
  flute: -0.2,
  clarinet: 0.1,
  harp: -0.45,
};

function panned(ctx: BaseAudioContext, dest: AudioNode, pan: number): AudioNode {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(dest);
  return p;
}

/** Attack, hold at `vel`, release. */
function envelope(ctx: BaseAudioContext, n: Note, attack: number, release: number): GainNode {
  const g = ctx.createGain();
  const end = n.at + Math.max(n.dur, attack);
  g.gain.setValueAtTime(0.0001, n.at);
  g.gain.linearRampToValueAtTime(n.vel, n.at + attack);
  g.gain.setValueAtTime(n.vel, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  return g;
}

/** Vibrato that fades in after `delay` s (players do not start a note with vibrato). */
function vibrato(
  ctx: BaseAudioContext,
  osc: OscillatorNode,
  n: Note,
  rate: number,
  depth: number,
  delay: number,
) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate * (0.95 + Math.random() * 0.1);
  const amount = ctx.createGain();
  amount.gain.setValueAtTime(0, n.at);
  amount.gain.linearRampToValueAtTime(0, n.at + delay);
  amount.gain.linearRampToValueAtTime(n.freq * depth, n.at + delay + 0.4);
  lfo.connect(amount).connect(osc.frequency);
  return lfo;
}

const STRINGS: Record<'violins' | 'violas' | 'cellos' | 'basses', { cutoff: number; players: number }> = {
  violins: { cutoff: 3600, players: 3 },
  violas: { cutoff: 2600, players: 2 },
  cellos: { cutoff: 1700, players: 2 },
  basses: { cutoff: 900, players: 2 },
};

/** A string section. `attack` near 0.1 for melody, 0.6–1.5 for sustained chords. */
export function strings(
  ctx: BaseAudioContext,
  dest: AudioNode,
  section: keyof typeof STRINGS,
  n: Note,
  attack = 0.18,
) {
  const { cutoff, players } = STRINGS[section];
  const out = panned(ctx, dest, PAN[section]);
  const env = envelope(ctx, n, attack, 0.9);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  lp.Q.value = 0.5;
  lp.connect(env).connect(out);
  const stop = n.at + Math.max(n.dur, attack) + 1;
  // One vibrato for the section (cheaper than one per player; the detuning keeps it an ensemble).
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.3 * (0.95 + Math.random() * 0.1);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, n.at);
  depth.gain.linearRampToValueAtTime(0, n.at + 0.25);
  depth.gain.linearRampToValueAtTime(n.freq * 0.004, n.at + 0.65);
  lfo.connect(depth);
  const level = 1 / players;
  for (let i = 0; i < players; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = n.freq;
    osc.detune.value = (i - (players - 1) / 2) * 9 + (Math.random() - 0.5) * 4;
    depth.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(lp);
    // Players never start exactly together.
    osc.start(n.at + Math.random() * 0.025);
    osc.stop(stop);
  }
  lfo.start(n.at);
  lfo.stop(stop);
}

export function horn(ctx: BaseAudioContext, dest: AudioNode, n: Note) {
  const out = panned(ctx, dest, PAN.horn);
  const env = envelope(ctx, n, 0.09, 0.45);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  // Brass "bloom": brighter as the note speaks, then mellow.
  lp.frequency.setValueAtTime(350, n.at);
  lp.frequency.linearRampToValueAtTime(Math.min(2200, n.freq * 6), n.at + 0.12);
  lp.frequency.linearRampToValueAtTime(Math.min(1300, n.freq * 4), n.at + 0.5);
  lp.connect(env).connect(out);
  const stop = n.at + n.dur + 0.6;
  for (const cents of [-4, 4]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = n.freq;
    osc.detune.value = cents;
    const lfo = vibrato(ctx, osc, n, 4.8, 0.002, 0.35);
    osc.connect(lp);
    osc.start(n.at);
    lfo.start(n.at);
    osc.stop(stop);
    lfo.stop(stop);
  }
}

export function flute(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, n: Note) {
  const out = panned(ctx, dest, PAN.flute);
  const env = envelope(ctx, n, 0.07, 0.25);
  env.connect(out);
  const stop = n.at + n.dur + 0.4;
  const osc = ctx.createOscillator();
  osc.frequency.value = n.freq;
  const lfo = vibrato(ctx, osc, n, 5, 0.005, 0.22);
  osc.connect(env);
  const second = ctx.createOscillator();
  second.type = 'triangle';
  second.frequency.value = n.freq * 2;
  const secondLevel = ctx.createGain();
  secondLevel.gain.value = 0.07;
  second.connect(secondLevel).connect(env);
  // Breath: a little noise around the note, strongest at the start.
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = n.freq * 2;
  bp.Q.value = 1.5;
  const breathLevel = ctx.createGain();
  breathLevel.gain.setValueAtTime(0.18, n.at);
  breathLevel.gain.exponentialRampToValueAtTime(0.05, n.at + 0.15);
  breath.connect(bp).connect(breathLevel).connect(env);
  for (const s of [osc, second, lfo, breath]) {
    s.start(n.at, s === breath ? Math.random() : undefined);
    s.stop(stop);
  }
}

export function clarinet(ctx: BaseAudioContext, dest: AudioNode, n: Note) {
  const out = panned(ctx, dest, PAN.clarinet);
  const env = envelope(ctx, n, 0.06, 0.3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(2400, n.freq * 5);
  lp.connect(env).connect(out);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = n.freq;
  const lfo = vibrato(ctx, osc, n, 4.5, 0.002, 0.4);
  const level = ctx.createGain();
  level.gain.value = 0.45;
  osc.connect(level).connect(lp);
  const stop = n.at + n.dur + 0.4;
  for (const s of [osc, lfo]) {
    s.start(n.at);
    s.stop(stop);
  }
}

/** Plucked and ringing. `bend` slides up into the note (the "luyến" of Vietnamese zither playing). */
export function harp(ctx: BaseAudioContext, dest: AudioNode, n: Note, bend = 0) {
  const out = panned(ctx, dest, PAN.harp);
  const ring = Math.min(3.2, 1.2 + 260 / n.freq);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, n.at);
  env.gain.linearRampToValueAtTime(n.vel, n.at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, n.at + ring);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4200, n.at);
  lp.frequency.exponentialRampToValueAtTime(1200, n.at + ring);
  lp.connect(env).connect(out);
  for (const [ratio, level, type] of [
    [1, 1, 'triangle'],
    [2, 0.35, 'sine'],
    [3, 0.12, 'sine'],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    const f = n.freq * ratio;
    osc.frequency.setValueAtTime(bend ? f * 2 ** (-bend / 1200) : f, n.at);
    if (bend) osc.frequency.exponentialRampToValueAtTime(f, n.at + 0.12);
    const lvl = ctx.createGain();
    lvl.gain.value = level;
    osc.connect(lvl).connect(lp);
    osc.start(n.at);
    osc.stop(n.at + ring + 0.05);
  }
}

/** One timpani stroke. */
export function timpani(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, n: Note) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, n.at);
  env.gain.linearRampToValueAtTime(n.vel, n.at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, n.at + 1.8);
  env.connect(dest);
  for (const [ratio, level] of [
    [1, 1],
    [1.5, 0.35],
    [1.98, 0.15],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(n.freq * ratio * 1.02, n.at);
    osc.frequency.exponentialRampToValueAtTime(n.freq * ratio, n.at + 0.15);
    const lvl = ctx.createGain();
    lvl.gain.value = level;
    osc.connect(lvl).connect(env);
    osc.start(n.at);
    osc.stop(n.at + 1.9);
  }
  const thump = ctx.createBufferSource();
  thump.buffer = noise;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 350;
  const tl = ctx.createGain();
  tl.gain.setValueAtTime(n.vel * 0.6, n.at);
  tl.gain.exponentialRampToValueAtTime(0.0001, n.at + 0.12);
  thump.connect(lp).connect(tl).connect(dest);
  thump.start(n.at, Math.random());
  thump.stop(n.at + 0.15);
}

/**
 * A soft timpani roll that swells and fades over `dur`. Built as one sustained drum tone with fast
 * tremolo (the alternating sticks) instead of dozens of separate strokes: same sound, a fraction of the work.
 */
export function timpaniRoll(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, n: Note) {
  const end = n.at + n.dur;
  const swell = ctx.createGain();
  swell.gain.setValueAtTime(0.0001, n.at);
  swell.gain.linearRampToValueAtTime(n.vel * 0.5, n.at + n.dur * 0.65);
  swell.gain.exponentialRampToValueAtTime(0.0001, end + 0.8);
  swell.connect(dest);
  // Tremolo: the gain wobbles 11 times a second between half and full.
  const strokes = ctx.createGain();
  strokes.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 11;
  const depth = ctx.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(strokes.gain);
  strokes.connect(swell);
  const drum = ctx.createOscillator();
  drum.frequency.value = n.freq;
  const skin = ctx.createBufferSource();
  skin.buffer = noise;
  skin.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const skinLevel = ctx.createGain();
  skinLevel.gain.value = 0.5;
  drum.connect(strokes);
  skin.connect(lp).connect(skinLevel).connect(strokes);
  for (const s of [lfo, drum, skin]) {
    s.start(n.at);
    s.stop(end + 0.9);
  }
}

/** Ocean swell under the sea music. */
export function waves(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noise: AudioBuffer,
  at: number,
  seconds: number,
  vel: number,
) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, at);
  lp.frequency.linearRampToValueAtTime(750, at + seconds * 0.45);
  lp.frequency.linearRampToValueAtTime(280, at + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vel, at + seconds * 0.45);
  g.gain.linearRampToValueAtTime(0.0001, at + seconds);
  src.connect(lp).connect(g).connect(dest);
  src.start(at, Math.random());
  src.stop(at + seconds + 0.1);
}
