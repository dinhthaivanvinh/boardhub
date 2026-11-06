'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Sound on the stage and host screens: off by default, remembered on this device (docs/office/07 §7). */
export const useOfficeSound = create<{ on: boolean; toggle(): void }>()(
  persist((set) => ({ on: false, toggle: () => set((s) => ({ on: !s.on })) }), { name: 'bg-office-sound' }),
);

/*
 * Every sound is synthesised with Web Audio — no audio files, so nothing to license (docs/office/assets.md).
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** The office audio context (shared with the party games), or null without Web Audio. */
export function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function noiseBuffer(a: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** One snare-like hit at time `at`. */
function hit(a: AudioContext, at: number, volume: number) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  const gain = a.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(at, Math.random() * 0.5, 0.1);
}

/** A drumroll that gets faster and louder until stopped. Returns the stop function. */
export function startDrumroll(): () => void {
  const a = audio();
  if (!a) return () => {};
  let stopped = false;
  let next = a.currentTime + 0.05;
  const begin = next;
  const timer = window.setInterval(() => {
    // Schedule a little ahead, so hits stay even even if the timer is late.
    while (!stopped && next < a.currentTime + 0.25) {
      const elapsed = next - begin;
      const gap = Math.max(0.045, 0.14 - elapsed * 0.025);
      hit(a, next, Math.min(0.5, 0.12 + elapsed * 0.06));
      next += gap;
    }
  }, 60);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

function tone(
  a: AudioContext,
  freq: number,
  at: number,
  length: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** "Ting!" then a short happy arpeggio: the winner is in. */
export function playWin() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.02;
  tone(a, 1318.5, t, 1.2, 0.35);
  tone(a, 2637, t, 0.6, 0.08);
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, f, t + 0.25 + i * 0.09, 0.5, 0.18, 'triangle'));
  // A soft "crowd" swell of filtered noise.
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
  src.stop(t + 2.1);
}

/** A small pop for reactions. */
export function playPop() {
  const a = audio();
  if (!a) return;
  tone(a, 880 + Math.random() * 300, a.currentTime + 0.01, 0.12, 0.08, 'triangle');
}

/** Must be called from a click: browsers only allow sound after the user did something. */
export function unlockAudio() {
  audio();
}
