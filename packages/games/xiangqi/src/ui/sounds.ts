import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import type { XiangqiState } from '../rules/types';

export const music: MusicMood = 'calm';

export const moveSounds: MoveSounds<XiangqiState> = (before, after) => {
  const cues: SoundCue[] = [{ kind: after.captured.length > before.captured.length ? 'capture' : 'move' }];
  if (after.inCheck !== null && after.status === 'playing') cues.push({ kind: 'check', delay: 180 });
  return cues;
};
