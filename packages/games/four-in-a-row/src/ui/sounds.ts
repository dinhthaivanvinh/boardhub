import type { MoveSounds, MusicMood } from '@bg/ui';
import type { FourState } from '../rules/types';

export const music: MusicMood = 'calm';
export const moveSounds: MoveSounds<FourState> = () => [{ kind: 'drop' }];
