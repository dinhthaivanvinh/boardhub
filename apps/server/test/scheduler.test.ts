import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualJobScheduler, TimerJobScheduler, type Job } from '../src/hub/scheduler';

const job = (n: number): Job => ({ kind: 'clock', roomId: `r${n}`, matchId: `m${n}` });

describe('TimerJobScheduler (single process)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('runs a job at its time, once', async () => {
    const s = new TimerJobScheduler();
    const ran: Job[] = [];
    s.start(async (j) => void ran.push(j));
    await s.schedule('a', Date.now() + 500, job(1));
    await vi.advanceTimersByTimeAsync(499);
    expect(ran).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(ran).toEqual([job(1)]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ran).toHaveLength(1);
  });

  it('scheduling the same key again replaces the job; cancel removes it', async () => {
    const s = new TimerJobScheduler();
    const ran: Job[] = [];
    s.start(async (j) => void ran.push(j));
    await s.schedule('a', Date.now() + 100, job(1));
    await s.schedule('a', Date.now() + 200, job(2));
    await s.schedule('b', Date.now() + 100, job(3));
    await s.cancel('b');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(ran).toEqual([job(2)]);
  });

  it('jobs scheduled before start run once started; nothing runs after stop', async () => {
    const s = new TimerJobScheduler();
    const ran: Job[] = [];
    await s.schedule('early', Date.now() + 50, job(1));
    await vi.advanceTimersByTimeAsync(100);
    s.start(async (j) => void ran.push(j));
    await vi.advanceTimersByTimeAsync(0);
    expect(ran).toEqual([job(1)]);
    await s.schedule('late', Date.now() + 50, job(2));
    await s.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(ran).toEqual([job(1)]);
  });

  it('reports handler errors instead of throwing', async () => {
    const onError = vi.fn();
    const s = new TimerJobScheduler(Date.now, onError);
    s.start(async () => {
      throw new Error('boom');
    });
    await s.schedule('a', Date.now(), job(1));
    await vi.advanceTimersByTimeAsync(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), job(1));
  });
});

describe('ManualJobScheduler (tests)', () => {
  it('runs due jobs in time order when advanced, including ones they schedule', async () => {
    const s = new ManualJobScheduler();
    const ran: string[] = [];
    s.start(async (j) => {
      ran.push(j.roomId);
      if (j.roomId === 'r1') await s.schedule('chained', 15, job(3));
    });
    await s.schedule('b', 20, job(2));
    await s.schedule('a', 10, job(1));
    expect(s.has('a')).toBe(true);
    await s.advanceTo(20);
    expect(ran).toEqual(['r1', 'r3', 'r2']);
    expect(s.has('')).toBe(false);
  });
});
