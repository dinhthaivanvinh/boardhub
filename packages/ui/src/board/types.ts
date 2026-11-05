import type { Seat } from '@bg/engine';
import type { SoundCue } from './sound';

/** Translator from the app (next-intl in apps/web). Keys are full paths, e.g. 'games.caro.cellLabel'. */
export type Translator = (key: string, values?: Record<string, string | number>) => string;

export interface BoardSettings {
  showLegalMoves: boolean;
  animations: boolean;
  coordinates: boolean;
  /** Tap twice to confirm a move. Useful on small screens. */
  confirmMove: boolean;
}

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  showLegalMoves: true,
  animations: true,
  coordinates: false,
  confirmMove: false,
};

/** Props every game board component receives (docs/08-frontend-guidelines.md §2). */
export interface BoardProps<V, M> {
  /** playerView for the viewer, never the full state. */
  view: V;
  /** null = spectator. */
  mySeat: Seat | null;
  isMyTurn: boolean;
  legalMoves?: M[];
  lastMove?: M;
  /** Rotate the board so this seat is at the bottom. */
  orientation?: Seat;
  onMove(move: M): void;
  /** Waiting for the server, replaying, or the bot is thinking. */
  disabled?: boolean;
  settings: BoardSettings;
  t: Translator;
  /**
   * For boards that play a move out over time (Ô ăn quan sows stone by stone): sounds in step with
   * their own animation. Other boards ignore it; the app plays their MoveSounds.
   */
  playSound?(cue: SoundCue): void;
}

/** Describes one config field so the app can render a generic setup form. */
export type ConfigFieldSpec =
  { key: string; kind: 'select'; options: readonly (string | number)[] } | { key: string; kind: 'boolean' };
