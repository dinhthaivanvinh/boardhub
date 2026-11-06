'use client';

import { audio, noiseBuffer } from '@/features/office/draw-player/sounds';

/*
 * Tết sounds for Lì xì, all synthesised with Web Audio (no audio files): a lion-dance drum roll with
 * cymbals, a gong, rustling paper, a "ting", firecrackers and fireworks, and a bouncy original tune
 * for bamboo flute (sáo), zither (đàn tranh), bass, drums, cymbals and a wood block (mõ).
 */

/** Everything goes through one bus, so the music can be ducked under the draw. */
let bus: { sfx: GainNode; music: GainNode } | null = null;

function graph() {
  const a = audio();
  if (!a) return null;
  if (!bus) {
    const comp = a.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.connect(a.destination);
    const sfx = a.createGain();
    sfx.connect(comp);
    const music = a.createGain();
    music.gain.value = 0.55;
    music.connect(comp);
    bus = { sfx, music };
  }
  return { a, ...bus };
}

function env(a: AudioContext, at: number, peak: number, attack: number, decay: number, out: AudioNode) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(out);
  return g;
}

function noise(
  a: AudioContext,
  at: number,
  length: number,
  filter: BiquadFilterType,
  freq: number,
  q: number,
  out: AudioNode,
) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.05);
}

/** Trống lân: a deep drum with a falling pitch and a thump of skin. */
function drum(a: AudioContext, at: number, volume: number, out: AudioNode, pitch = 1) {
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140 * pitch, at);
  osc.frequency.exponentialRampToValueAtTime(52 * pitch, at + 0.22);
  osc.connect(env(a, at, volume, 0.004, 0.42, out));
  osc.start(at);
  osc.stop(at + 0.5);
  noise(a, at, 0.06, 'lowpass', 900, 0.7, env(a, at, volume * 0.5, 0.002, 0.06, out));
}

/** Chũm chọe: a bright, shimmering crash. */
function cymbal(a: AudioContext, at: number, volume: number, out: AudioNode, length = 0.9) {
  noise(a, at, length, 'highpass', 6500, 0.5, env(a, at, volume, 0.003, length, out));
  [540, 813, 1137].forEach((f) => {
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(env(a, at, volume * 0.05, 0.003, length * 0.6, out));
    o.start(at);
    o.stop(at + length);
  });
}

/** The lion-dance roll while the light looks for someone. Returns the stop function. */
export function startLionDrums(): () => void {
  const g = graph();
  if (!g) return () => {};
  const { a, sfx } = g;
  let stopped = false;
  let next = a.currentTime + 0.05;
  const begin = next;
  let n = 0;
  const timer = window.setInterval(() => {
    while (!stopped && next < a.currentTime + 0.3) {
      const elapsed = next - begin;
      const gap = Math.max(0.09, 0.26 - elapsed * 0.045);
      drum(a, next, Math.min(0.75, 0.35 + elapsed * 0.08), sfx, n % 4 === 0 ? 1 : 1.25);
      if (n % 8 === 0) cymbal(a, next, 0.12, sfx, 0.5);
      next += gap;
      n++;
    }
  }, 60);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

/** Chiêng: the light has stopped on someone. */
export function playGong() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  const at = a.currentTime + 0.02;
  [
    [98, 0.5, 4],
    [196.5, 0.22, 3],
    [263, 0.14, 2.4],
    [347, 0.1, 1.8],
    [521, 0.05, 1.2],
  ].forEach(([f, v, d]) => {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f! * 1.01, at);
    o.frequency.exponentialRampToValueAtTime(f!, at + 0.4);
    o.connect(env(a, at, v!, 0.01, d!, sfx));
    o.start(at);
    o.stop(at + d! + 0.1);
  });
  drum(a, at, 0.8, sfx, 0.8);
}

/** The note sliding up out of the envelope. */
export function playSlide() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  const at = a.currentTime + 0.01;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(900, at);
  f.frequency.exponentialRampToValueAtTime(4200, at + 0.5);
  src.connect(f).connect(env(a, at, 0.12, 0.08, 0.45, sfx));
  src.start(at);
  src.stop(at + 0.6);
}

/** Paper: the envelope's flap opening. */
export function playRustle() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  const at = a.currentTime + 0.01;
  for (let i = 0; i < 7; i++) {
    const t = at + i * 0.045 + Math.random() * 0.02;
    noise(a, t, 0.05, 'bandpass', 2500 + Math.random() * 3000, 1.2, env(a, t, 0.16, 0.004, 0.05, sfx));
  }
}

/** A short shake of the envelope. */
export function playShake() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  for (let i = 0; i < 4; i++) {
    const t = a.currentTime + 0.02 + i * 0.16;
    noise(a, t, 0.08, 'bandpass', 1800, 0.8, env(a, t, 0.08, 0.01, 0.08, sfx));
  }
}

/** "Ting!" and a run up the pentatonic scale: the note is out. */
export function playTing() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  const at = a.currentTime + 0.02;
  const bell = (f: number, t: number, v: number, d: number) => {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(env(a, t, v, 0.004, d, sfx));
    o.start(t);
    o.stop(t + d + 0.05);
  };
  bell(1568, at, 0.3, 1.4);
  bell(3136, at, 0.06, 0.6);
  [523.25, 587.33, 698.46, 783.99, 880, 1046.5].forEach((f, i) => bell(f, at + 0.2 + i * 0.07, 0.12, 0.5));
}

/** Pháo: a string of firecrackers. */
export function playFirecrackers(seconds = 1.4) {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  const at = a.currentTime + 0.05;
  let t = at;
  while (t < at + seconds) {
    const v = 0.25 + Math.random() * 0.35;
    noise(a, t, 0.03, 'highpass', 900 + Math.random() * 1500, 0.6, env(a, t, v, 0.001, 0.035, sfx));
    t += 0.025 + Math.random() * 0.06;
  }
}

/** Fireworks for the biggest note: a whistle up, then a boom. */
export function playFireworks() {
  const g = graph();
  if (!g) return;
  const { a, sfx } = g;
  [0, 0.5, 0.9].forEach((d) => {
    const at = a.currentTime + 0.05 + d;
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(700, at);
    o.frequency.exponentialRampToValueAtTime(2200, at + 0.5);
    o.connect(env(a, at, 0.05, 0.05, 0.45, sfx));
    o.start(at);
    o.stop(at + 0.55);
    drum(a, at + 0.55, 0.7, sfx, 0.6);
    noise(a, at + 0.55, 1.2, 'lowpass', 2500, 0.5, env(a, at + 0.55, 0.25, 0.005, 1.2, sfx));
  });
}

/** Lowers the music under the draw (and brings it back). */
export function duckMusic(down: boolean) {
  const g = graph();
  if (!g) return;
  g.music.gain.setTargetAtTime(down ? 0.18 : 0.55, g.a.currentTime, 0.4);
}

// ---------- Music ----------

const NOTE = (name: string) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)!;
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] ? 1 : 0);
  return 440 * 2 ** ((semis + (Number(m[3]) - 4) * 12 - 9) / 12);
};

/**
 * An original, bouncy tune on the major pentatonic C D E G A (the bright scale of Vietnamese spring
 * songs): two eight-bar halves, mostly quavers, over an oom-pah bass, a zither and festival drums.
 */
const TUNE = [
  'E5/0.5 G5/0.5 A5/0.5 G5/0.5 E5/1 D5/1',
  'C5/0.5 D5/0.5 E5/0.5 G5/0.5 E5/2',
  'D5/0.5 E5/0.5 D5/0.5 C5/0.5 A4/1 C5/1',
  'D5/0.5 E5/0.5 D5/0.5 C5/0.5 D5/2',
  'E5/0.5 G5/0.5 A5/0.5 C6/0.5 A5/1 G5/1',
  'E5/0.5 G5/0.5 E5/0.5 D5/0.5 C5/1 A4/1',
  'G4/0.5 A4/0.5 C5/0.5 D5/0.5 E5/1 D5/0.5 E5/0.5',
  'C5/1.5 G4/0.5 C5/1 -/1',
  'A5/0.5 A5/0.5 G5/0.5 E5/0.5 G5/1 A5/1',
  'G5/0.5 E5/0.5 D5/0.5 E5/0.5 G5/2',
  'E5/0.5 E5/0.5 D5/0.5 C5/0.5 D5/1 E5/1',
  'D5/0.5 C5/0.5 A4/0.5 C5/0.5 D5/2',
  'E5/0.5 G5/0.5 A5/1 G5/0.5 A5/0.5 C6/1',
  'A5/0.5 G5/0.5 E5/0.5 G5/0.5 A5/2',
  'G5/0.5 E5/0.5 D5/0.5 C5/0.5 D5/0.5 E5/0.5 G5/1',
  'C6/1 G5/0.5 E5/0.5 C5/1 -/1',
];
/** The chord under each bar. */
const CHORDS = ['C', 'C', 'Am', 'G', 'C', 'Am', 'G', 'C', 'F', 'C', 'Am', 'G', 'F', 'Am', 'G', 'C'];
/** Root, fifth, octave, fifth (the bass takes the first two). */
const ARP: Record<string, string[]> = {
  C: ['C3', 'G3', 'C4', 'G3'],
  F: ['F2', 'C3', 'F3', 'C3'],
  G: ['G2', 'D3', 'G3', 'D3'],
  Am: ['A2', 'E3', 'A3', 'E3'],
};
const BPM = 138;

/** Sáo: a breathy flute with a little scoop into the note and a late vibrato. */
function sao(a: AudioContext, out: AudioNode, f: number, at: number, length: number) {
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.975, at);
  o.frequency.exponentialRampToValueAtTime(f, at + 0.08);
  const vib = a.createOscillator();
  vib.frequency.value = 5.4;
  const depth = a.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(f * 0.008, at + Math.min(0.5, length * 0.6));
  vib.connect(depth).connect(o.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.09, at + 0.06);
  g.gain.setTargetAtTime(0.06, at + 0.1, 0.2);
  g.gain.setTargetAtTime(0.0001, at + length * 0.92, 0.05);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + length + 0.3);
  vib.start(at);
  vib.stop(at + length + 0.3);
  noise(a, at, length * 0.9, 'bandpass', f * 2, 2, env(a, at, 0.012, 0.05, length * 0.85, out));
}

/** Đàn tranh: a plucked string, bright then mellow. */
function tranh(a: AudioContext, out: AudioNode, f: number, at: number, volume: number) {
  const o = a.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const o2 = a.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2.003;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 8, at);
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.6);
  const g = env(a, at, volume, 0.003, 1.3, out);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  o.start(at);
  o2.start(at);
  o.stop(at + 1.4);
  o2.stop(at + 1.4);
}

/** Mõ: a wooden knock on the off-beats. */
function mo(a: AudioContext, out: AudioNode, at: number, volume: number) {
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1150, at);
  o.frequency.exponentialRampToValueAtTime(760, at + 0.04);
  o.connect(env(a, at, volume, 0.001, 0.07, out));
  o.start(at);
  o.stop(at + 0.1);
}

/** A plucked bass, short so it bounces. */
function bass(a: AudioContext, out: AudioNode, f: number, at: number, volume: number) {
  const o = a.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(env(a, at, volume, 0.004, 0.32, out));
  o.start(at);
  o.stop(at + 0.4);
}

function scheduleBar(a: AudioContext, out: AudioNode, bar: number, at: number) {
  const beat = 60 / BPM;
  let b = 0;
  for (const token of TUNE[bar]!.split(' ')) {
    const [name, len] = token.split('/');
    const beats = Number(len);
    if (name !== '-') sao(a, out, NOTE(name!), at + b * beat, beats * beat);
    b += beats;
  }
  const arp = ARP[CHORDS[bar]!]!;
  // Oom-pah: root on 1 and 3, fifth on 2 and 4; the zither runs up and down above.
  for (let i = 0; i < 4; i++) bass(a, out, NOTE(arp[i % 2]!), at + i * beat, i % 2 === 0 ? 0.2 : 0.13);
  for (let i = 0; i < 8; i++)
    tranh(
      a,
      out,
      NOTE(arp[[0, 1, 2, 3, 2, 1, 2, 3][i]!]!) * 2,
      at + i * beat * 0.5,
      i % 2 === 0 ? 0.06 : 0.04,
    );
  // Festival drums: tùng on 1 and 3 with pick-ups, cắc (a small cymbal) on 2 and 4, mõ on the off-beats.
  drum(a, at, 0.26, out);
  drum(a, at + 1.5 * beat, 0.12, out, 1.25);
  drum(a, at + 2 * beat, 0.22, out);
  drum(a, at + 3.5 * beat, 0.14, out, 1.3);
  if (bar % 2 === 1) drum(a, at + 3.75 * beat, 0.12, out, 1.4);
  cymbal(a, at + beat, 0.03, out, 0.14);
  cymbal(a, at + 3 * beat, 0.03, out, 0.14);
  for (let i = 0; i < 4; i++) mo(a, out, at + (i + 0.5) * beat, 0.07);
  if (bar % 4 === 0) cymbal(a, at, 0.06, out, 0.8);
}

/** Starts the Tết tune, looping; returns a function that fades it out. */
export function startTetMusic(): () => void {
  const g = graph();
  if (!g) return () => {};
  const { a, music } = g;
  const fader = a.createGain();
  fader.gain.setValueAtTime(0.0001, a.currentTime);
  fader.gain.exponentialRampToValueAtTime(1, a.currentTime + 2);
  fader.connect(music);
  const barSeconds = (4 * 60) / BPM;
  let bar = 0;
  let next = a.currentTime + 0.1;
  const tick = () => {
    while (next < a.currentTime + 1.5) {
      scheduleBar(a, fader, bar, next);
      next += barSeconds;
      bar = (bar + 1) % TUNE.length;
    }
  };
  tick();
  const timer = window.setInterval(tick, 250);
  return () => {
    window.clearInterval(timer);
    const t = a.currentTime;
    fader.gain.cancelScheduledValues(t);
    fader.gain.setValueAtTime(Math.max(fader.gain.value, 0.0001), t);
    fader.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    window.setTimeout(() => fader.disconnect(), 4000);
  };
}
