'use client';

/**
 * The audio graph shared by every game screen (docs/08 §10):
 *
 *   effects ─┐
 *            ├─ master ─ compressor ─ speakers
 *   music ───┤
 *   reverb ──┘   (effects and music each send a little to a shared room reverb)
 *
 * Browsers only allow sound after the person has interacted with the page, so the context is created on
 * the first tap or key press. Before that, sounds are skipped (never queued). In a hidden tab everything
 * is suspended.
 */

export interface AudioGraph {
  ctx: AudioContext;
  effects: GainNode;
  music: GainNode;
  /** Send to the reverb (connect a node here in addition to its bus). */
  reverb: GainNode;
  noise: AudioBuffer;
}

let graph: AudioGraph | null = null;
let unlockInstalled = false;
const listeners = new Set<(g: AudioGraph) => void>();

function build(): AudioGraph | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  const ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  const master = ctx.createGain();
  master.connect(comp);

  const effects = ctx.createGain();
  const music = ctx.createGain();
  effects.connect(master);
  music.connect(master);

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx, 2.4, 2.8);
  const reverb = ctx.createGain();
  reverb.gain.value = 0.6;
  reverb.connect(convolver).connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  return { ctx, effects, music, reverb, noise };
}

/** A room-like reverb tail: stereo noise that dies away. */
function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buf;
}

/** The audio graph, or null until the person has interacted with the page. */
export function audio(): AudioGraph | null {
  if (graph && graph.ctx.state === 'suspended' && !document.hidden) void graph.ctx.resume();
  return graph;
}

/** Runs `fn` as soon as sound is allowed (now, if it already is). */
export function whenAudio(fn: (g: AudioGraph) => void): () => void {
  installUnlock();
  if (graph) {
    fn(graph);
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Creates the audio context on the first tap, click or key press (browser autoplay rules). */
export function installUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    if (graph) return;
    graph = build();
    if (!graph) return;
    void graph.ctx.resume();
    for (const fn of listeners) fn(graph);
    listeners.clear();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** Bus volumes from the settings; changes glide so nothing clicks. */
export function setVolumes(effects: number, music: number): void {
  const g = graph;
  if (!g) return;
  const t = g.ctx.currentTime;
  g.effects.gain.setTargetAtTime(effects, t, 0.05);
  g.music.gain.setTargetAtTime(music, t, 0.3);
}
