import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import type { CoGanhState } from '../rules/types';

/** A Vietnamese folk game: pentatonic folk music. */
export const music: MusicMood = 'folk';

/** The piece moves; pieces won by "gánh" or "vây" change colour one after another. */
export const moveSounds: MoveSounds<CoGanhState> = (_before, after) => {
  const cues: SoundCue[] = [{ kind: 'move' }];
  const won = after.carried.length + after.surrounded.length;
  if (won > 0) cues.push({ kind: 'flip', count: won, delay: 160 });
  return cues;
};
