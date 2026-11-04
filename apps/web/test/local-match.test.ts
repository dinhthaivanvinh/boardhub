import { describe, expect, it, vi } from 'vitest';
import { definition as caro } from '@bg/game-caro/rules';
import { LocalMatch, newSeed } from '../src/game-runtime/local-match';
import type { SeatController } from '../src/game-runtime/match-setup';

const HUMAN: SeatController = { kind: 'human' };
const BOT: SeatController = { kind: 'bot', level: 'easy' };

const hotSeat = () => new LocalMatch(caro, {}, [HUMAN, HUMAN], 'seed');
const vsBot = () => new LocalMatch(caro, {}, [HUMAN, BOT], 'seed');

describe('LocalMatch', () => {
  it('starts with seat 0 to move and notifies subscribers on every move', () => {
    const m = hotSeat();
    const listener = vi.fn();
    m.subscribe(listener);
    expect(m.getSnapshot()).toMatchObject({ version: 0, activeSeats: [0], moves: [], result: null });
    expect(m.submit(0, { cell: 112 }).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(m.getSnapshot()).toMatchObject({
      version: 1,
      activeSeats: [1],
      moves: [{ seat: 0, move: { cell: 112 } }],
    });
  });

  it('returns a new snapshot object only when something changes', () => {
    const m = hotSeat();
    const before = m.getSnapshot();
    expect(m.getSnapshot()).toBe(before);
    expect(m.submit(1, { cell: 0 })).toEqual({ ok: false, code: 'engine.not_your_turn' });
    expect(m.getSnapshot()).toBe(before);
  });

  it('can unsubscribe', () => {
    const m = hotSeat();
    const listener = vi.fn();
    m.subscribe(listener)();
    m.submit(0, { cell: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('knows whose turn it is: human or bot', () => {
    const m = vsBot();
    expect(m.humanToMove()).toBe(0);
    expect(m.botToMove()).toBeNull();
    m.submit(0, { cell: 112 });
    expect(m.humanToMove()).toBeNull();
    expect(m.botToMove()).toEqual({ seat: 1, level: 'easy' });
  });

  it('undo in hot-seat takes back one move', () => {
    const m = hotSeat();
    expect(m.canUndo()).toBe(false);
    m.submit(0, { cell: 1 });
    m.submit(1, { cell: 2 });
    expect(m.undo()).toBe(true);
    expect(m.getSnapshot().moves).toEqual([{ seat: 0, move: { cell: 1 } }]);
    expect(m.getSnapshot().state.board[2]).toBeNull();
  });

  it('undo against a bot also removes the bot reply', () => {
    const m = vsBot();
    m.submit(0, { cell: 112 });
    m.submit(1, { cell: 113 });
    m.submit(0, { cell: 127 });
    m.submit(1, { cell: 128 });
    m.undo();
    expect(m.getSnapshot().moves.map((x) => x.move)).toEqual([{ cell: 112 }, { cell: 113 }]);
    expect(m.humanToMove()).toBe(0);
    m.undo();
    expect(m.getSnapshot().moves).toEqual([]);
    expect(m.undo()).toBe(false);
  });

  it('resign gives the win to the other seat and undo cancels it', () => {
    const m = vsBot();
    m.submit(0, { cell: 112 });
    m.submit(1, { cell: 113 });
    m.resign(0);
    expect(m.getSnapshot().result).toEqual({ kind: 'win', winners: [1], reason: 'resign' });
    expect(m.getSnapshot().activeSeats).toEqual([]);
    expect(m.submit(0, { cell: 1 })).toEqual({ ok: false, code: 'engine.game_over' });
    expect(m.botToMove()).toBeNull();
    m.resign(0); // no-op once over
    m.undo();
    expect(m.getSnapshot().result).toBeNull();
  });

  it('detects the end of the game', () => {
    const m = hotSeat();
    for (const [x, o] of [
      [112, 0],
      [113, 2],
      [114, 4],
      [115, 6],
    ] as const) {
      m.submit(0, { cell: x });
      m.submit(1, { cell: o });
    }
    m.submit(0, { cell: 116 });
    expect(m.getSnapshot().result).toMatchObject({ kind: 'win', winners: [0] });
    expect(m.humanToMove()).toBeNull();
  });

  it('applies the config', () => {
    expect(new LocalMatch(caro, { size: 19 }, [HUMAN, HUMAN], 's').getSnapshot().state.board).toHaveLength(
      361,
    );
  });
});

describe('newSeed', () => {
  it('returns different non-empty seeds', () => {
    const a = newSeed();
    expect(a.length).toBeGreaterThan(10);
    expect(newSeed()).not.toBe(a);
  });
});
