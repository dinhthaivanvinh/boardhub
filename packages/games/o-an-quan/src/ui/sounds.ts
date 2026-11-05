import type { MoveSounds, MusicMood } from '@bg/ui';
import type { OAnQuanState } from '../rules/types';

/** A Vietnamese folk game: pentatonic folk music. */
export const music: MusicMood = 'folk';

/** Silent here: the board sounds every stone itself, in step with its animation (BoardProps.playSound). */
export const moveSounds: MoveSounds<OAnQuanState> = () => [];
