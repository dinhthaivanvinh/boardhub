import { describe, expect, it } from 'vitest';
import { createRng } from '@bg/engine';
import { definition as caro } from '@bg/game-caro/rules';
import { computeBotMove } from '../src/game-runtime/bot-compute';
import { errorKey } from '../src/game-runtime/error-key';
import { buildPlayUrl, controllersFor, parseMatchSetup } from '../src/game-runtime/match-setup';
import { getMessagesFor, toLocale } from '../src/i18n/messages';

const DEFAULTS = { size: 15, winLength: 5, blockedEndsRule: true, exactLength: false };

describe('parseMatchSetup', () => {
  it('uses safe defaults for missing or bad params', () => {
    expect(parseMatchSetup('caro', {})).toEqual({
      mode: 'bot',
      level: 'medium',
      humanSeat: 0,
      config: DEFAULTS,
    });
    expect(parseMatchSetup('caro', { level: 'godlike', side: '7', config: '{oops' })).toEqual({
      mode: 'bot',
      level: 'medium',
      humanSeat: 0,
      config: DEFAULTS,
    });
    expect(parseMatchSetup('caro', { config: '{"size":17}' }).config).toEqual(DEFAULTS);
  });

  it('round-trips through buildPlayUrl', () => {
    const setup = {
      mode: 'bot' as const,
      level: 'hard' as const,
      humanSeat: 1,
      config: { ...DEFAULTS, size: 19 },
    };
    const url = new URL(buildPlayUrl('caro', setup), 'http://x');
    expect(url.pathname).toBe('/play/caro');
    expect(parseMatchSetup('caro', Object.fromEntries(url.searchParams))).toEqual(setup);
  });

  it('local mode has no bot params', () => {
    const url = buildPlayUrl('caro', { mode: 'local', level: 'easy', humanSeat: 0, config: DEFAULTS });
    expect(url).not.toContain('level=');
    expect(parseMatchSetup('caro', Object.fromEntries(new URL(url, 'http://x').searchParams)).mode).toBe(
      'local',
    );
  });

  it('accepts array params (repeated keys)', () => {
    expect(parseMatchSetup('caro', { mode: ['local', 'bot'] }).mode).toBe('local');
  });
});

describe('controllersFor', () => {
  it('puts the bot opposite the human', () => {
    const base = { level: 'easy' as const, config: {} };
    expect(controllersFor({ ...base, mode: 'bot', humanSeat: 1 }, 2)).toEqual([
      { kind: 'bot', level: 'easy' },
      { kind: 'human' },
    ]);
    expect(controllersFor({ ...base, mode: 'local', humanSeat: 0 }, 2)).toEqual([
      { kind: 'human' },
      { kind: 'human' },
    ]);
  });
});

describe('errorKey', () => {
  it('maps codes to i18n keys', () => {
    expect(errorKey('caro.cell_occupied')).toBe('games.caro.errors.cell_occupied');
    expect(errorKey('engine.not_your_turn')).toBe('engine.not_your_turn');
    expect(errorKey('network')).toBe('errors.network');
    expect(errorKey('room.not_found')).toBe('errors.room.not_found');
    expect(errorKey('match.stale_seq')).toBe('errors.match.stale_seq');
    expect(errorKey('four-in-a-row.column_full')).toBe('games.four-in-a-row.errors.column_full');
  });
});

describe('computeBotMove', () => {
  it('returns a legal move and is reproducible for the same seed and move index', () => {
    const state = caro.setup(caro.configSchema.parse({}), 2, { rng: createRng('s', -1) });
    const req = {
      gameId: 'caro' as const,
      state,
      seat: 0,
      level: 'easy' as const,
      seed: 'abc',
      moveIndex: 0,
    };
    const move = computeBotMove(req);
    expect(caro.validateMove(state, 0, move as { cell: number }).ok).toBe(true);
    expect(computeBotMove(req)).toEqual(move);
  });
});

describe('i18n messages', () => {
  it('falls back to Vietnamese', () => {
    expect(toLocale(undefined)).toBe('vi');
    expect(toLocale('fr')).toBe('vi');
    expect(toLocale('en')).toBe('en');
  });

  it('merges game strings under games.<id> and both locales have the same keys', () => {
    const keys = (obj: unknown, prefix = ''): string[] =>
      obj && typeof obj === 'object'
        ? Object.entries(obj).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix.slice(0, -1)];
    const vi = getMessagesFor('vi');
    const en = getMessagesFor('en');
    expect(vi.games.caro).toHaveProperty('name', 'Caro');
    expect(keys(vi).sort()).toEqual(keys(en).sort());
  });
});
