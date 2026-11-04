import { BOT_LEVELS, type BotLevel } from '@bg/bots';
import type { Seat } from '@bg/engine';
import { GAMES, type GameId } from '@/games/catalog';

export type PlayMode = 'local' | 'bot';

export type SeatController = { kind: 'human' } | { kind: 'bot'; level: BotLevel };

/** Everything needed to start a local match. Built from the URL so a setup can be shared or reloaded. */
export interface MatchSetup {
  mode: PlayMode;
  level: BotLevel;
  /** Seat of the human in bot mode. */
  humanSeat: Seat;
  /** Already validated against the game's configSchema (defaults filled in). */
  config: Record<string, unknown>;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses /play/<gameId>?mode=&level=&side=&config= and falls back to safe defaults on bad input. */
export function parseMatchSetup(gameId: GameId, params: SearchParams): MatchSetup {
  const mode: PlayMode = first(params.mode) === 'local' ? 'local' : 'bot';
  const levelParam = first(params.level);
  const level: BotLevel = BOT_LEVELS.includes(levelParam as BotLevel) ? (levelParam as BotLevel) : 'medium';
  const humanSeat: Seat = first(params.side) === '1' ? 1 : 0;

  const { configSchema } = GAMES[gameId].definition;
  let raw: unknown;
  try {
    raw = JSON.parse(first(params.config) ?? '{}');
  } catch {
    raw = {};
  }
  const parsed = configSchema.safeParse(raw);
  const config = (parsed.success ? parsed.data : configSchema.parse({})) as Record<string, unknown>;

  return { mode, level, humanSeat, config };
}

export function buildPlayUrl(gameId: GameId, setup: MatchSetup): string {
  const q = new URLSearchParams({ mode: setup.mode, config: JSON.stringify(setup.config) });
  if (setup.mode === 'bot') {
    q.set('level', setup.level);
    q.set('side', String(setup.humanSeat));
  }
  return `/play/${gameId}?${q.toString()}`;
}

export function controllersFor(setup: MatchSetup, players: number): SeatController[] {
  return Array.from({ length: players }, (_, seat): SeatController =>
    setup.mode === 'bot' && seat !== setup.humanSeat
      ? { kind: 'bot', level: setup.level }
      : { kind: 'human' },
  );
}
