import { describe, expect, it } from 'vitest';
import { definition } from '../src/rules/definition';
import { buildFleet, shipCells, STOCK_LAYOUTS } from '../src/rules/fleet';
import { setup } from '../src/rules/rules';
import type { BanTauView } from '../src/rules/types';
import { at, battle, fireAll, play } from './helpers';

// Stock layout 1 (seat 1): carrier down column J rows 1-5, battleship down column C rows 1-4,
// cruiser F6-H6, submarine H8-J8, destroyer B10-C10.
const carrier = [at(9, 1), at(9, 2), at(9, 3), at(9, 4), at(9, 5)];
const destroyer = [at(1, 10), at(2, 10)];

describe('placing ships', () => {
  it('seat 0 places first, then seat 1, then seat 0 fires first', () => {
    let s = setup({});
    expect(definition.activePlayers(s)).toEqual([0]);
    s = play(s, 0, { kind: 'place', ships: STOCK_LAYOUTS[0]! });
    expect(s.phase).toBe('placing');
    expect(definition.activePlayers(s)).toEqual([1]);
    s = play(s, 1, { kind: 'place', ships: STOCK_LAYOUTS[1]! });
    expect(s.phase).toBe('battle');
    expect(definition.activePlayers(s)).toEqual([0]);
  });

  it('ship cells across and down; off the edge is refused', () => {
    expect(shipCells(at(6, 1), 4, true)).toEqual([6, 7, 8, 9]);
    expect(shipCells(at(7, 1), 4, true)).toBeNull();
    expect(shipCells(at(0, 7), 4, false)).toEqual([60, 70, 80, 90]);
    expect(shipCells(at(0, 8), 4, false)).toBeNull();
    expect(shipCells(-1, 2, true)).toBeNull();
  });

  it.each([
    [STOCK_LAYOUTS[0]!.slice(0, 4), 'ban-tau.bad_fleet'],
    [[{ cell: 7, horizontal: true }, ...STOCK_LAYOUTS[0]!.slice(1)], 'ban-tau.out_of_bounds'],
    [[{ cell: 20, horizontal: true }, ...STOCK_LAYOUTS[0]!.slice(1)], 'ban-tau.overlap'],
  ])('a bad fleet is refused (%#)', (ships, code) => {
    expect(definition.validateMove(setup({}), 0, { kind: 'place', ships })).toEqual({ ok: false, code });
  });

  it('touching ships are fine', () => {
    const touching = [0, 10, 20, 30, 40].map((cell) => ({ cell, horizontal: true }));
    expect(buildFleet(touching).ok).toBe(true);
  });

  it('cannot place twice, or fire while placing', () => {
    const s = play(setup({}), 0, { kind: 'place', ships: STOCK_LAYOUTS[0]! });
    expect(definition.validateMove(s, 0, { kind: 'place', ships: STOCK_LAYOUTS[1]! }).ok).toBe(false);
    expect(definition.validateMove(s, 1, { kind: 'fire', cell: 0 })).toEqual({
      ok: false,
      code: 'ban-tau.wrong_phase',
    });
    expect(definition.validateMove(battle(), 0, { kind: 'place', ships: STOCK_LAYOUTS[0]! })).toEqual({
      ok: false,
      code: 'ban-tau.wrong_phase',
    });
  });
});

describe('firing', () => {
  it('a hit earns another shot; a miss passes the turn', () => {
    let s = battle();
    s = play(s, 0, { kind: 'fire', cell: carrier[0]! });
    expect(s.lastShot).toEqual({ seat: 0, cell: carrier[0], hit: true, sunk: null });
    expect(s.turn).toBe(0);
    s = play(s, 0, { kind: 'fire', cell: at(0, 1) });
    expect(s.lastShot?.hit).toBe(false);
    expect(s.turn).toBe(1);
  });

  it('cannot fire at the same square twice, or off the sea', () => {
    const s = play(battle(), 0, { kind: 'fire', cell: carrier[0]! });
    expect(definition.validateMove(s, 0, { kind: 'fire', cell: carrier[0]! })).toEqual({
      ok: false,
      code: 'ban-tau.already_shot',
    });
    expect(definition.validateMove(s, 0, { kind: 'fire', cell: 100 })).toEqual({
      ok: false,
      code: 'ban-tau.out_of_bounds',
    });
  });

  it('the last square of a ship sinks it and says which one', () => {
    const s = fireAll(battle(), 0, destroyer);
    expect(s.lastShot).toEqual({ seat: 0, cell: destroyer[1], hit: true, sunk: 4 });
    expect(s.sunk[1]).toEqual([4]);
  });

  it('sinking the whole fleet wins', () => {
    const all = buildFleet(STOCK_LAYOUTS[1]!);
    if (!all.ok) throw new Error('layout');
    const s = fireAll(
      battle(),
      0,
      all.ships.flatMap((ship) => ship.cells),
    );
    expect(s.phase).toBe('over');
    expect(definition.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'fleet_sunk' });
    expect(definition.activePlayers(s)).toEqual([]);
    expect(definition.legalMoves!(s, 0)).toEqual([]);
  });

  it('legal moves: stock layouts while placing, unshot squares in battle', () => {
    expect(definition.legalMoves!(setup({}), 0)).toHaveLength(3);
    const placed = play(setup({}), 0, { kind: 'place', ships: STOCK_LAYOUTS[0]! });
    expect(definition.legalMoves!(placed, 0)).toEqual([]);
    const s = play(battle(), 0, { kind: 'fire', cell: 50 });
    expect(definition.legalMoves!(s, 0)).toHaveLength(99);
    expect(definition.result(s)).toBeNull();
  });
});

describe('what each side may see (playerView)', () => {
  it('your own fleet; of the enemy only what was sunk; every shot', () => {
    const s = fireAll(battle(), 0, [...destroyer, carrier[0]!]);
    const seat0 = definition.playerView(s, 0) as BanTauView;
    expect(seat0.fleets[0]).toHaveLength(5);
    expect(seat0.fleets[1].map((x) => x.id)).toEqual([4]);
    expect(seat0.shots[0]).toHaveLength(3);
    const seat1 = definition.playerView(s, 1) as typeof seat0;
    expect(seat1.fleets[0]).toEqual([]);
    expect(seat1.fleets[1]).toHaveLength(5);
    const watcher = definition.playerView(s, 'spectator') as typeof seat0;
    expect(watcher.fleets[0]).toEqual([]);
    expect(watcher.fleets[1].map((x) => x.id)).toEqual([4]);
    expect(watcher.placed).toEqual([true, true]);
  });

  it('nothing of the first fleet is shown while the second side places', () => {
    const s = play(setup({}), 0, { kind: 'place', ships: STOCK_LAYOUTS[0]! });
    const view = definition.playerView(s, 1) as { fleets: unknown[][]; placed: boolean[] };
    expect(view.fleets[0]).toEqual([]);
    expect(view.placed).toEqual([true, false]);
  });

  it('everything is shown once the game is over', () => {
    const all = buildFleet(STOCK_LAYOUTS[1]!);
    if (!all.ok) throw new Error('layout');
    const s = fireAll(
      battle(),
      0,
      all.ships.flatMap((ship) => ship.cells),
    );
    const loser = definition.playerView(s, 1) as { fleets: unknown[][] };
    expect(loser.fleets[0]).toHaveLength(5);
  });
});
