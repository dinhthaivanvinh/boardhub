import type { MoveSounds, MusicMood } from '@bg/ui';
import type { CaroState } from '../rules/types';

export const music: MusicMood = 'calm';
export const moveSounds: MoveSounds<CaroState> = () => [{ kind: 'place' }];
