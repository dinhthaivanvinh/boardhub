/** Seat 0 places first and fires first. */
export type BanTauSeat = 0 | 1;

export type Ship = { id: number; size: number; cells: number[] };
export type Shot = { cell: number; hit: boolean };
export type Placement = { cell: number; horizontal: boolean };

export type BanTauMove = { kind: 'place'; ships: Placement[] } | { kind: 'fire'; cell: number };

export type BanTauConfig = Record<string, never>;

export type BanTauPhase = 'placing' | 'battle' | 'over';

export type LastShot = { seat: BanTauSeat; cell: number; hit: boolean; sunk: number | null };

export type BanTauState = {
  config: BanTauConfig;
  phase: BanTauPhase;
  /** Who is placing ships, or who is firing. */
  turn: BanTauSeat;
  /** HIDDEN from the opponent: each seat's ships (null until placed). */
  fleets: [Ship[] | null, Ship[] | null];
  /** Shots fired BY seat i into the opponent's sea. Public. */
  shots: [Shot[], Shot[]];
  /** Ids of seat i's ships that have been sunk. Public. */
  sunk: [number[], number[]];
  lastShot: LastShot | null;
  moveCount: number;
  winner: BanTauSeat | null;
};

/** What one viewer may see (rule E10). */
export type BanTauView = {
  config: BanTauConfig;
  phase: BanTauPhase;
  turn: BanTauSeat;
  /** Seat i's ships this viewer may see: all of their own, only the sunk ones of the opponent (all when over). */
  fleets: [Ship[], Ship[]];
  /** Whether seat i has placed its ships. */
  placed: [boolean, boolean];
  shots: [Shot[], Shot[]];
  sunk: [number[], number[]];
  lastShot: LastShot | null;
  moveCount: number;
  winner: BanTauSeat | null;
};
