import { afterEach, describe, expect, it } from 'vitest';
import { playMoves } from '@bg/engine/testing';
import { definition as caro } from '@bg/game-caro/rules';
import { WorkerBotRunner, type BotRequest } from '../src/bots/bot-runner';

// X has four in a row on row 7 (columns 3..6) with both ends open: a real bot finishes the line.
const at = (row: number, col: number) => row * 15 + col;
const view = playMoves(
  caro,
  {},
  [at(7, 3), at(0, 0), at(7, 4), at(0, 14), at(7, 5), at(14, 0), at(7, 6), at(14, 14)].map((cell) => ({
    cell,
  })),
);
const request: BotRequest = { gameId: 'caro', view, seat: 0, level: 'medium', seed: 's', moveIndex: 8 };
const winning = [{ cell: at(7, 2) }, { cell: at(7, 7) }];

let runner: WorkerBotRunner | null = null;
afterEach(async () => {
  await runner?.close();
  runner = null;
});

describe('WorkerBotRunner', () => {
  it('thinks in a worker thread and finds the winning move', async () => {
    runner = new WorkerBotRunner(1);
    expect(winning).toContainEqual(await runner.choose(request));
    expect(runner.degraded).toBe(false);
  }, 30_000);

  it('a worker that cannot start is not respawned forever; bots still think properly', async () => {
    const failures: Error[] = [];
    runner = new WorkerBotRunner(2, new URL('./no-such-worker.mjs', import.meta.url), (err) =>
      failures.push(err),
    );
    expect(winning).toContainEqual(await runner.choose(request));
    expect(runner.degraded).toBe(true);
    // Give a runaway respawn loop the chance to show itself: it must have stopped.
    await new Promise((r) => setTimeout(r, 500));
    expect(failures).toHaveLength(1);
    expect(winning).toContainEqual(await runner.choose(request));
  }, 30_000);
});
