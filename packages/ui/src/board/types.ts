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
  assist?: BoardAssist;
}

/** Squares to point out on a board, and the same said in words (never by colour alone). */
export interface CoachAdvice {
  /** Cell indexes in the board's own numbering. For a hint: from, then to. */
  cells: readonly number[];
  text(t: Translator): string;
  /** The same to be read aloud, in parts that are recorded one by one. */
  speech(t: Translator): string[];
}

/** Optional help for someone playing the computer. A game that offers it exports `coach`. */
export interface Coach<V> {
  /** Something the player should look at before moving, or null. Cheap: asked after every move. */
  warn(view: V, seat: Seat): CoachAdvice | null;
  /** A move worth a look, asked for with a button. Null when there is none. */
  hint(view: V, seat: Seat): CoachAdvice | null;
  /** Said and shown with the last hint a game allows. */
  lastHint(t: Translator): string;
  voice: {
    /** Gets the recordings of a language ready, so the first sentence can already come from them. */
    prepare(lang: string): void;
    say(parts: readonly string[], lang: string): void;
    stop(): void;
  };
}

/** What a board is asked to point out. Boards of games without a coach never get it. */
export interface BoardAssist {
  warn?: readonly number[];
  hint?: readonly number[];
}

/** Describes one config field so the app can render a generic setup form. */
export type ConfigFieldSpec =
  { key: string; kind: 'select'; options: readonly (string | number)[] } | { key: string; kind: 'boolean' };
