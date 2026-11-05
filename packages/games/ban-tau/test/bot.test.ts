import { describe, expect, it } from 'vitest';
import { createRng, runMove, type Seat } from '@bg/engine';
import type { BotLevel } from '@bg/bots';
import { bot, heatMap, randomPlacement } from '../src/bot';
import { definition } from '../src/rules/definition';
import { buildFleet } from '../src/rules/fleet';
import { playerView, setup } from '../src/rules/rules';
import type { BanTauMove, BanTauState } from '../src/rules/types';
import { at, battle, play } from './helpers';

/** The bot only ever gets its own view (rule B4). */
const choose = (s: BanTauState, level: BotLevel, seed = 'b') =>
  bot.chooseMove({
    state: playerView(s, s.turn),
    seat: s.turn,
    level,
    rng: createRng(seed, s.moveCount),
    deadlineMs: Date.now() + 1_000,
  });

/** A full game between two bot levels; returns the winning seat. */
function game(levels: [BotLevel, BotLevel], seed: string): Seat {
  let s = setup({});
  for (let ply = 0; ply < 500; ply++) {
    const result = definition.result(s);
    if (result?.kind === 'win') return result.winners[0]!;
    const seat = s.turn;
    const move = bot.chooseMove({
      state: playerView(s, seat),
      seat,
      level: levels[seat]!,
      rng: createRng(`${seed}:${seat}`, ply),
      deadlineMs: Date.now() + 1_000,
    });
    const res = runMove(definition, s, seat, move, { rng: createRng(seed, ply) });
    if (!res.ok) throw new Error(`illegal bot move ${JSON.stringify(move)}: ${res.code}`);
    s = res.state;
  }
  throw new Error('no result');
}

describe('ban-tau bot', () => {
  it('places a valid fleet at every level; hard keeps ships apart', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = choose(setup({}), level) as Extract<BanTauMove, { kind: 'place' }>;
      expect(definition.validateMove(setup({}), 0, move)).toEqual({ ok: true });
    }
    for (let i = 0; i < 20; i++) {
      const fleet = buildFleet(randomPlacement(createRng('apart', i), true));
      if (!fleet.ok) throw new Error('bad fleet');
      const cells = fleet.ships.map((s) => new Set(s.cells));
      for (const [a, ship] of fleet.ships.entries()) {
        for (const c of ship.cells) {
          const r = Math.floor(c / 10);
          const col = c % 10;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const n = (r + dr) * 10 + col + dc;
              if (r + dr < 0 || r + dr > 9 || col + dc < 0 || col + dc > 9) continue;
              cells.forEach((set, b) => b !== a && expect(set.has(n)).toBe(false));
            }
        }
      }
    }
  });

  it('after a hit, medium and hard fire next to it', () => {
    // Seat 1's carrier runs down column J; seat 0 hit J3 and missed elsewhere.
    let s = play(battle(), 0, { kind: 'fire', cell: at(9, 3) });
    s = play(s, 0, { kind: 'fire', cell: at(0, 0 + 1) });
    s = { ...s, turn: 0 };
    for (const level of ['medium', 'hard'] as const) {
      const move = choose(s, level) as Extract<BanTauMove, { kind: 'fire' }>;
      expect([at(9, 2), at(9, 4), at(8, 3)]).toContain(move.cell);
    }
  });

  it('the heat map rules out squares next to misses where no ship fits', () => {
    const heat = heatMap({
      shot: new Set([1, 10]),
      misses: new Set([1, 10]),
      openHits: [],
      sunkCells: new Set(),
      remaining: [5],
    });
    // The corner is boxed in by two misses: a 5-long ship cannot pass through it.
    expect(heat[0]).toBe(0);
    expect(heat[55]!).toBeGreaterThan(0);
  });

  it('never sees hidden ships: same view, same move', () => {
    const a = battle();
    const other = buildFleet([
      { cell: 0, horizontal: false },
      { cell: 1, horizontal: false },
      { cell: 2, horizontal: false },
      { cell: 3, horizontal: false },
      { cell: 4, horizontal: false },
    ]);
    if (!other.ok) throw new Error('layout');
    const b: BanTauState = { ...a, fleets: [a.fleets[0], other.ships] };
    expect(choose(a, 'hard', 'same')).toEqual(choose(b, 'hard', 'same'));
  });

  it('every level plays legal moves through a whole game, and hard beats easy most of the time', () => {
    game(['easy', 'medium'], 'legal');
    let hardWins = 0;
    for (let g = 0; g < 10; g++)
      hardWins += game(g % 2 ? ['hard', 'easy'] : ['easy', 'hard'], `hve${g}`) === (g % 2 ? 0 : 1) ? 1 : 0;
    expect(hardWins).toBeGreaterThanOrEqual(8);
  }, 60_000);
});
