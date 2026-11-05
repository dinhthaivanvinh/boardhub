/**
 * Sound contract between games and the app (docs/08 §10). Games only *name* what happened;
 * the app decides how it sounds, how loud, and whether sound is on at all.
 */
export type SoundCueKind =
  /** A stone or disc set down on a board (Caro, Reversi). */
  | 'place'
  /** A disc falling into a column (Bốn trong hàng). */
  | 'drop'
  /** A piece moved from one point to another (chess, xiangqi, Cờ gánh). */
  | 'move'
  /** A piece taken off the board. */
  | 'capture'
  /** Discs turned over (Reversi) or pieces won over (Cờ gánh); `count` = how many. */
  | 'flip'
  /** A king or general is in check. */
  | 'check'
  /** Stones picked up from a square (Ô ăn quan). */
  | 'pick'
  /** One stone dropped into a square (Ô ăn quan). */
  | 'sow'
  /** A shot into empty water (Bắn tàu). */
  | 'splash'
  /** A shot hits a ship. */
  | 'hit'
  /** The last part of a ship is hit. */
  | 'sunk'
  /** Ships placed, ready for battle. */
  | 'ready'
  /** A move the rules refuse. */
  | 'invalid';

export interface SoundCue {
  kind: SoundCueKind;
  /** For flips: how many pieces (the sound repeats, quickly). */
  count?: number;
  /** Start this long after the move, in ms (e.g. a capture after the move sound). */
  delay?: number;
}

/**
 * What a move sounds like, worked out from the viewer's views before and after it.
 * Called only when exactly one move was made (moveCount + 1). Must be pure.
 */
export type MoveSounds<V> = (before: V, after: V) => SoundCue[];

/** Background music style for a game (generated in the app, never an audio file). */
export type MusicMood = 'calm' | 'folk' | 'sea';
