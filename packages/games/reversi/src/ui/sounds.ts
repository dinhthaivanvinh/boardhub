import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import type { ReversiState } from '../rules/types';

export const music: MusicMood = 'calm';

/** The disc goes down, then the captured discs turn over one after another. */
export const moveSounds: MoveSounds<ReversiState> = (_before, after) => {
  const cues: SoundCue[] = [];
  if (after.lastMove !== null) cues.push({ kind: 'place' });
  if (after.flipped.length > 0) cues.push({ kind: 'flip', count: after.flipped.length, delay: 120 });
  return cues;
};
