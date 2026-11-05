import { describe, expect, it } from 'vitest';
import { definition as caro } from '@bg/game-caro/rules';
import {
  asMatchDetail,
  humanSeatOf,
  localOutcome,
  newLocalMatchId,
  toLocalRecord,
} from '../src/game-runtime/local-history';
import { LocalMatch } from '../src/game-runtime/local-match';
import type { SeatController } from '../src/game-runtime/match-setup';
import { buildReplay } from '../src/game-runtime/replay';

const HUMAN: SeatController = { kind: 'human' };
const BOT: SeatController = { kind: 'bot', level: 'hard' };

/** Seat 0 plays a row of five on row 0 while seat 1 plays on row 2. */
function finished(controllers: SeatController[]) {
  const m = new LocalMatch(caro, {}, controllers, 'seed-1');
  for (let i = 0; i < 5; i++) {
    m.submit(0, { cell: i });
    if (i < 4) m.submit(1, { cell: 30 + i });
  }
  const snap = m.getSnapshot();
  return toLocalRecord({
    id: m.id,
    gameId: 'caro',
    rulesVersion: caro.meta.rulesVersion,
    config: m.config,
    seed: m.seed,
    controllers,
    moves: snap.moves,
    result: snap.result!,
    startedAt: m.startedAt,
    endedAt: m.startedAt + 1_000,
  });
}

describe('local game history', () => {
  it('a finished game against the computer replays to the same final position', () => {
    const rec = finished([HUMAN, BOT]);
    expect(rec).toMatchObject({
      mode: 'bot',
      players: [
        { seat: 0, botLevel: null },
        { seat: 1, botLevel: 'hard' },
      ],
      result: { kind: 'win', winners: [0] },
    });
    expect(rec.moves).toHaveLength(9);
    expect(humanSeatOf(rec)).toBe(0);
    expect(localOutcome(rec)).toBe('win');

    const states = buildReplay(caro, asMatchDetail(rec));
    expect(states).toHaveLength(10);
    expect(caro.result(states.at(-1) as never)).toMatchObject({ kind: 'win', winners: [0] });
  });

  it('records the loss when the computer wins, and has no side at one screen', () => {
    const lost = finished([BOT, HUMAN]);
    expect(humanSeatOf(lost)).toBe(1);
    expect(localOutcome(lost)).toBe('loss');

    const hotSeat = finished([HUMAN, HUMAN]);
    expect(hotSeat.mode).toBe('local');
    expect(humanSeatOf(hotSeat)).toBeNull();
    expect(localOutcome(hotSeat)).toBe('played');
  });

  it('copies the moves, so later changes to the match do not touch a saved record', () => {
    const rec = finished([HUMAN, BOT]);
    const copy = structuredClone(rec);
    (rec.moves[0]!.move as { cell: number }).cell = 99;
    expect(copy.moves[0]!.move).toEqual({ cell: 0 });
  });

  it('ids are 32 hex digits and unique', () => {
    const ids = new Set(Array.from({ length: 50 }, newLocalMatchId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});
