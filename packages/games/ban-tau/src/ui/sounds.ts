import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import type { BanTauView } from '../rules/types';

/** Out at sea: waves under the music. */
export const music: MusicMood = 'sea';

/** A shot lands in the water, or hits (and maybe sinks) a ship; placing a fleet sounds "ready". */
export const moveSounds: MoveSounds<BanTauView> = (before, after) => {
  const shot = after.lastShot;
  const fired =
    shot !== null &&
    (before.lastShot === null || before.shots[shot.seat]!.length !== after.shots[shot.seat]!.length);
  if (!fired) return [{ kind: 'ready' }];
  if (!shot.hit) return [{ kind: 'splash' }];
  const cues: SoundCue[] = [{ kind: 'hit' }];
  if (shot.sunk !== null) cues.push({ kind: 'sunk', delay: 350 });
  return cues;
};
