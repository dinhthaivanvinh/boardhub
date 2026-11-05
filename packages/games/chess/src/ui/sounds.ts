import type { MoveSounds, MusicMood, SoundCue } from '@bg/ui';
import type { ChessState } from '../rules/types';

export const music: MusicMood = 'calm';

export const moveSounds: MoveSounds<ChessState> = (_before, after) => {
  const last = after.lastMove;
  if (!last) return [];
  const cues: SoundCue[] = [{ kind: last.captured ? 'capture' : 'move' }];
  // Castling moves the rook too.
  if (last.castle) cues.push({ kind: 'move', delay: 140 });
  if (after.inCheck !== null && after.status === 'playing') cues.push({ kind: 'check', delay: 180 });
  return cues;
};
